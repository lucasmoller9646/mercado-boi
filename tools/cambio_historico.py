#!/usr/bin/env python3
"""Série diária longa do dólar no Paraguai: cotização referencial do BCP (Gs por US$), 2010 em diante.

Fonte: https://www.bcp.gov.py/webapps/web/cotizacion/monedas-historica?anho=AAAA&moneda=USD
(uma tabela por ano: linhas = dia 1 a 31, colunas = ENE a DIC, "ND" onde não houve cotação).

Grava data/pyg_historico.json = {"fonte", "atualizado", "d": [AAAA-MM-DD...], "v": [Gs...]}.
Com o arquivo já existente, busca só o ano corrente (e o anterior em janeiro); `--tudo` refaz desde 2010.
O painel usa a série para o histórico do termômetro técnico (o que o câmbio fez depois de leituras parecidas).
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ = os.path.join(RAIZ, "data", "pyg_historico.json")
URL = "https://www.bcp.gov.py/webapps/web/cotizacion/monedas-historica?anho=%d&moneda=USD"
UA = {"User-Agent": "Mozilla/5.0 (mercado-boi; +https://lucasmoller9646.github.io/mercado-boi/)"}
INICIO = 2010


def baixar(url, tentativas=3):
    for k in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            if k == tentativas - 1:
                raise
            time.sleep(5 * (k + 1))


def num_es(s):
    s = s.strip()
    if not s or s.upper() == "ND":
        return None
    try:
        return float(s.replace(".", "").replace(",", "."))
    except ValueError:
        return None


def ano(a):
    """{AAAA-MM-DD: Gs} de um ano."""
    pag = baixar(URL % a)
    tabelas = re.findall(r"<table[^>]*>(.*?)</table>", pag, re.S | re.I)
    alvo = next((t for t in tabelas if re.search(r">\s*ENE\s*<", t)), None)
    if alvo is None:
        raise ValueError("tabela do ano %d não encontrada" % a)
    out = {}
    for linha in re.findall(r"<tr[^>]*>(.*?)</tr>", alvo, re.S | re.I):
        cel = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", linha, re.S | re.I)]
        if len(cel) < 13 or not cel[0].isdigit():
            continue
        dia = int(cel[0])
        for mes in range(1, 13):
            v = num_es(cel[mes])
            if v is None:
                continue
            try:
                d = dt.date(a, mes, dia)
            except ValueError:
                continue
            if 1000 < v < 20000:
                out[d.isoformat()] = round(v, 2)
    return out


def main():
    tudo = "--tudo" in sys.argv
    hoje = dt.date.today()
    serie, velho = {}, None
    try:
        with open(ARQ, encoding="utf-8") as f:
            velho = json.load(f)
        serie = dict(zip(velho["d"], velho["v"]))
    except Exception:
        tudo = True
    anos = range(INICIO, hoje.year + 1) if tudo else ([hoje.year - 1] if hoje.month == 1 else []) + [hoje.year]
    for a in anos:
        novo = ano(a)
        if not novo:
            print("ano", a, "veio vazio", file=sys.stderr)
            continue
        for k in [k for k in serie if k.startswith("%d-" % a)]:
            del serie[k]
        serie.update(novo)
        print("ano", a, len(novo), "dias")
    ds = sorted(serie)
    obj = {"fonte": "BCP, cotização referencial do dólar (Gs por US$), dia a dia — webapps/web/cotizacion/monedas-historica",
           "atualizado": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "d": ds, "v": [serie[d] for d in ds]}
    if velho and velho.get("d") == obj["d"] and velho.get("v") == obj["v"]:
        print("nada mudou")
        return
    with open(ARQ, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("gravado", len(ds), "dias", ds[0], "a", ds[-1])


if __name__ == "__main__":
    main()

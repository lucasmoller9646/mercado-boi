#!/usr/bin/env python3
"""Robô do repositório (GitHub Actions): guarda, dia a dia, o Indicador do Boi DATAGRO (primitiva pública)
e as cotações do milho em Chicago (CME), que o navegador não consegue buscar sozinho.

Escreve data/boi_br_diario.json e data/cme_milho.json. Só usa endereços públicos, sem credencial.
"""
import json, os, sys, datetime as dt, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (mercado-boi; +https://lucasmoller9646.github.io/mercado-boi/)"}


def pegar(url, tempo=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=tempo) as r:
        return json.loads(r.read().decode("utf-8"))


def ler(nome, padrao):
    try:
        with open(os.path.join(RAIZ, "data", nome), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return padrao


def gravar(nome, obj):
    caminho = os.path.join(RAIZ, "data", nome)
    novo = json.dumps(obj, ensure_ascii=False, indent=1) + "\n"
    try:
        with open(caminho, encoding="utf-8") as f:
            if f.read() == novo:
                return False
    except FileNotFoundError:
        pass
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(novo)
    return True


def dolar_do_dia(dia):
    """Fechamento do dólar comercial (R$) no dia do indicador; se não houver, o último disponível."""
    serie = pegar("https://economia.awesomeapi.com.br/json/daily/USD-BRL/15")
    pontos = sorted(((dt.datetime.fromtimestamp(int(x["timestamp"]), dt.timezone(dt.timedelta(hours=-3))).date().isoformat(), float(x["bid"])) for x in serie))
    escolhido = None
    for d, v in pontos:
        if d <= dia:
            escolhido = v
    return escolhido or (pontos[-1][1] if pontos else None)


def boi_datagro():
    prim = pegar("https://precos.api.datagro.com/dados?a=D_PEPR_SP_BR")
    p = prim[0] if isinstance(prim, list) else prim
    dia, ult = str(p.get("dia", ""))[:10], p.get("ult")
    if not dia or not isinstance(ult, (int, float)) or ult <= 0:
        raise ValueError("primitiva sem dia ou preço")
    arq = ler("boi_br_diario.json", {"fonte": "", "pontos": []})
    arq["fonte"] = "Indicador do Boi DATAGRO SP (D_PEPR_SP_BR), R$/@ à vista; dólar comercial do dia (AwesomeAPI)"
    pts = {x["d"]: x for x in arq.get("pontos", [])}
    antes = pts.get(dia)
    brl = antes["brl"] if antes and antes.get("rs") == ult else dolar_do_dia(dia)
    pts[dia] = {"d": dia, "rs": ult, "var": p.get("var"), "brl": round(brl, 4) if brl else None}
    arq["pontos"] = [pts[k] for k in sorted(pts)]
    return gravar("boi_br_diario.json", arq), dia, ult


MESES = "FGHJKMNQUVXZ"


def contratos_milho(hoje, n=8):
    """Próximos vencimentos do milho na CME (mar, mai, jul, set, dez)."""
    out, ano, mes = [], hoje.year, hoje.month
    while len(out) < n:
        if mes in (3, 5, 7, 9, 12) and dt.date(ano, mes, 14) >= hoje:
            out.append(("ZC%s%02d" % (MESES[mes - 1], ano % 100), dt.date(ano, mes, 14)))
        mes += 1
        if mes > 12:
            mes, ano = 1, ano + 1
    return out


def milho_cme():
    hoje = dt.date.today()
    cs = []
    for cod, venc in contratos_milho(hoje):
        try:
            j = pegar("https://query1.finance.yahoo.com/v8/finance/chart/%s.CBT?range=5d&interval=1d" % cod)
            m = j["chart"]["result"][0]["meta"]
            preco, ant = m.get("regularMarketPrice"), m.get("chartPreviousClose") or m.get("previousClose")
            if preco and preco > 0:
                cs.append({"cod": cod, "venc": venc.isoformat(), "preco": round(preco, 2), "anterior": round(ant, 2) if ant else None})
        except Exception as e:  # contrato sem cotação: segue com os outros
            print("CME", cod, "sem cotação:", e, file=sys.stderr)
    if not cs:
        raise ValueError("nenhum contrato da CME respondeu")
    obj = {"atualizado": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "fonte": "CME via Yahoo Finance (centavos de dólar por bushel)", "contratos": cs}
    velho = ler("cme_milho.json", {})
    if [(c["cod"], c["preco"]) for c in velho.get("contratos", [])] == [(c["cod"], c["preco"]) for c in cs]:
        return False, len(cs)
    return gravar("cme_milho.json", obj), len(cs)


if __name__ == "__main__":
    falhas = 0
    for nome, f in (("DATAGRO", boi_datagro), ("CME", milho_cme)):
        try:
            print(nome, f())
        except Exception as e:
            falhas += 1
            print(nome, "falhou:", e, file=sys.stderr)
    sys.exit(1 if falhas == 2 else 0)

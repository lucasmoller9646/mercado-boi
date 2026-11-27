#!/usr/bin/env python3
"""Robô dos dados rápidos (GitHub Actions, a cada 20 minutos).

Grava, numa pasta de saída, dois arquivos públicos que vão para o ramo `dados` do repositório:
  cotacoes.json  as cotações do topo do painel, para os widgets do celular e do relógio
  noticias.json  manchetes recentes que mexem com o câmbio (Fed, BCP, inflação, juros, dólar)

Só usa fontes públicas. O câmbio do BCP vem da ponte do Apps Script no modo público, que devolve
apenas data, hora, compra, venda e acumulado do dia dos últimos cortes.
"""
import datetime as dt
import email.utils
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

SAIDA = sys.argv[1] if len(sys.argv) > 1 else "saida"
UA = {"User-Agent": "Mozilla/5.0 (mercado-boi; +https://lucasmoller9646.github.io/mercado-boi/)"}
PONTE = "https://script.google.com/macros/s/AKfycbwEXPbndqKzwWjeixsmZdqk0Q07u_r7-qxFsQwuzc6Dbz72rT3lnpwl6K7wjWj2qsX9/exec"
PLAN_GORDO = "1PSoOOJnJ2IdO6rn8fOx9Q8bTxSao6ioTN1oEbbp_qEs"
PLAN_REPO = "1_UbGp17HuOGgBG5K1PZ5iEpHH0HApQAf9bCXhYwKB6Y"
ASU = dt.timezone(dt.timedelta(hours=-3))


def baixar(url, tempo=30, tentativas=2):
    for k in range(tentativas):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=tempo) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == tentativas - 1:
                raise
            espera = e.headers.get("Retry-After")
            time.sleep(min(60, int(espera)) if espera and espera.isdigit() else 20)


def jbaixar(url, tempo=30):
    return json.loads(baixar(url, tempo))


def num(v):
    """Número de planilha: aceita 6.406,62 (es), 6,406.62 (us), 6406.62 e número de verdade."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("$", "").replace("%", "").replace(" ", "")
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", s):  # 6.406 no formato es = seis mil
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def gviz(plan, aba, cabecalhos=1, consulta=None):
    url = "https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:json&sheet=%s&headers=%d" % (plan, urllib.parse.quote(aba), cabecalhos)
    if consulta:
        url += "&tq=" + urllib.parse.quote(consulta)
    txt = baixar(url)
    j = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    rot = [c.get("label") or "" for c in j["table"]["cols"]]
    linhas = [[(c or {}).get("v") for c in (r.get("c") or [])] for r in j["table"]["rows"]]
    return rot, linhas


def data_gviz(v):
    m = re.match(r"Date\((\d+),(\d+),(\d+)", str(v or ""))
    return "%04d-%02d-%02d" % (int(m.group(1)), int(m.group(2)) + 1, int(m.group(3))) if m else None


def var(a, b):
    return a / b - 1 if a and b else None


# ------------------------------------------------------------------ cotações
def boi_py():
    rot, linhas = gviz(PLAN_GORDO, "Sheet1")
    iD, iN = rot.index("date"), rot.index("ganado_a_frigorifico__novillo__semana_actual")
    pts = sorted({data_gviz(l[iD]): num(l[iN]) for l in linhas if data_gviz(l[iD]) and (num(l[iN]) or 0) > 0}.items())
    d, v = pts[-1]
    ant = next((x for dd, x in reversed(pts) if dd < d and x != v), None)
    return {"id": "boi", "rot": "Boi PY", "val": v, "dec": 2, "un": "US$/kg carcaça", "var": var(v, ant), "quando": d, "fonte": "Valor Agro, novillo"}


def bezerro():
    rot, linhas = gviz(PLAN_REPO, "INDICADOR", 2)
    pts = [(data_gviz(l[0]), num(l[1])) for l in linhas if data_gviz(l[0]) and (num(l[1]) or 0) > 0]
    pts.sort()
    (d, v), (_, a) = pts[-1], pts[-2]
    return {"id": "bezerro", "rot": "Bezerro 180 kg", "val": v, "dec": 0, "un": "Gs/kg vivo", "var": var(v, a), "quando": d, "fonte": "Indicador dos leilões, semana"}


def b3(ativo, rot, un):
    j = jbaixar("https://cotacao.b3.com.br/mds/api/v1/DerivativeQuotation/" + ativo)
    hoje = dt.datetime.now(ASU).date().isoformat()
    cs = []
    for s in j.get("Scty", []):
        if not re.match("^" + ativo + r"[FGHJKMNQUVXZ]\d\d$", s.get("symb", "")) or not s.get("SctyQtn"):
            continue
        q, a = s["SctyQtn"], (s.get("asset") or {}).get("AsstSummry") or {}
        ult, aj = q.get("curPrc") or None, q.get("prvsDayAdjstmntPric") or None
        if a.get("mtrtyCode", "") >= hoje and (ult or aj):
            cs.append((a.get("opnCtrcts") or 0, s["symb"], ult, aj))
    _, cod, ult, aj = max(cs)
    return {"id": ativo.lower(), "rot": cod, "val": ult or aj, "dec": 2, "un": un, "var": var(ult, aj) if ult else None, "quando": (j.get("Msg") or {}).get("dtTm"), "fonte": "B3, vencimento mais líquido"}


def boi_sp():
    p = jbaixar("https://precos.api.datagro.com/dados?a=D_PEPR_SP_BR")
    p = p[0] if isinstance(p, list) else p
    return {"id": "boisp", "rot": "Boi SP", "val": float(p["ult"]), "dec": 2, "un": "R$/@", "var": float(p["var"]) / 100 if p.get("var") is not None else None,
            "quando": str(p.get("dia"))[:10], "fonte": "Indicador do Boi DATAGRO"}


def cme():
    meses, hoje, cs = "HKNUZ", dt.date.today(), []
    ano = hoje.year
    for y in (ano, ano + 1):
        for m, mm in zip(meses, (3, 5, 7, 9, 12)):
            if dt.date(y, mm, 14) >= hoje:
                cs.append("ZC%s%02d" % (m, y % 100))
    cod = cs[0]
    m = jbaixar("https://query1.finance.yahoo.com/v8/finance/chart/%s.CBT?range=5d&interval=1d" % cod)["chart"]["result"][0]["meta"]
    v, a = m.get("regularMarketPrice"), m.get("chartPreviousClose") or m.get("previousClose")
    return {"id": "cme", "rot": "CME " + cod[2:], "val": v, "dec": 0, "un": "¢/bushel", "var": var(v, a), "quando": None, "fonte": "Milho em Chicago"}


def brl():
    j = jbaixar("https://economia.awesomeapi.com.br/json/last/USD-BRL")["USDBRL"]
    return {"id": "brl", "rot": "R$/US$", "val": float(j["bid"]), "dec": 3, "un": "R$ por dólar", "var": float(j["pctChange"]) / 100, "quando": j.get("create_date"), "fonte": "Dólar comercial"}


def bcp():
    j = jbaixar(PONTE + "?publico=cambio", 60)
    if not j.get("ok"):
        raise ValueError(j.get("erro") or "ponte recusou")
    cab, linhas = j["cab"], j["linhas"]
    ix = {c: cab.index(c) for c in cab}

    def hora(v):
        if isinstance(v, (int, float)):
            m = round(v * 1440)
            return "%02d:%02d" % (m // 60, m % 60)
        m = re.search(r"(\d{1,2}):(\d{2})", str(v or ""))
        return "%02d:%s" % (int(m.group(1)), m.group(2)) if m else None

    def data(v):
        if isinstance(v, (int, float)):
            return (dt.date(1899, 12, 30) + dt.timedelta(days=int(v))).isoformat()
        s = str(v or "")
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s) or None
        if m:
            return s[:10]
        m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
        return "%s-%02d-%02d" % (m.group(3), int(m.group(2)), int(m.group(1))) if m else None

    cortes = []
    for l in linhas:
        c, v = num(l[ix["compra_corte"]]), num(l[ix["venda_corte"]])
        if not (c and c > 1000 and v and v > 1000) or re.match(r"^S", str(l[ix["corte_sem_negocios"]] or ""), re.I):
            continue
        cortes.append({"d": data(l[ix["data"]]), "h": hora(l[ix["hora_corte"]]), "compra": c, "venda": v,
                       "ca": num(l[ix["compra_acumulado"]]), "va": num(l[ix["venda_acumulado"]])})
    cortes = [x for x in cortes if x["d"] and x["h"]]
    cortes.sort(key=lambda x: x["d"] + x["h"])
    u = cortes[-1]
    ontem = next((x for x in reversed(cortes) if x["d"] < u["d"]), None)
    medio = lambda x: ((x["ca"] or x["compra"]) + (x["va"] or x["venda"])) / 2
    return {"id": "pyg", "rot": "Gs/US$", "val": u["compra"], "val2": u["venda"], "dec": 0, "un": "compra · venda", "var": var(medio(u), medio(ontem)) if ontem else None,
            "quando": u["d"] + " " + u["h"], "fonte": "BCP, corte de 30 minutos"}


# ------------------------------------------------------------------ notícias
CONSULTAS = [
    ("Paraguai", "es-419", "PY", "PY:es-419", '(dólar OR guaraní OR "tipo de cambio" OR BCP OR "Banco Central del Paraguay" OR inflación OR "tasa de política monetaria") when:1d'),
    ("EUA", "en-US", "US", "US:en", '(Fed OR FOMC OR Powell OR "Federal Reserve" OR CPI OR inflation OR payrolls OR "Treasury yields" OR "dollar index") when:1d'),
    ("Brasil", "pt-BR", "BR", "BR:pt-419", '(dólar OR Copom OR Selic OR "Banco Central" OR IPCA OR câmbio) when:1d'),
]
TEMAS = [
    ("Fed", r"\bfed\b|fomc|powell|federal reserve|reserva federal"),
    ("BCP", r"\bbcp\b|banco central del paraguay"),
    ("Inflação", r"\bcpi\b|\bipc\b|ipca|inflaci|inflation|inflação|precios al consumidor"),
    ("Juros", r"selic|copom|tasa de pol|interest rate|rate cut|rate hike|juros|treasury|yields"),
    ("Emprego", r"payroll|nonfarm|desemprego|desempleo|jobs report|empleo"),
    ("Câmbio", r"d[óo]lar|guaran[ií]|tipo de cambio|câmbio|cambio|dollar|real\b"),
]
PESO_TEMA = {"Fed": 3, "BCP": 3, "Inflação": 2, "Juros": 2, "Emprego": 2, "Câmbio": 1}


def noticias():
    itens, vistos = [], set()
    for regiao, hl, gl, ceid, q in CONSULTAS:
        url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": hl, "gl": gl, "ceid": ceid})
        try:
            raiz = ET.fromstring(baixar(url))
        except Exception as e:
            print("notícias", regiao, "falhou:", e, file=sys.stderr)
            continue
        for it in raiz.iter("item"):
            titulo = (it.findtext("title") or "").strip()
            fonte = (it.findtext("source") or "").strip()
            if fonte and titulo.endswith(" - " + fonte):
                titulo = titulo[: -len(" - " + fonte)]
            chave = re.sub(r"\W+", "", titulo.lower())[:80]
            if not titulo or chave in vistos:
                continue
            temas = [n for n, rx in TEMAS if re.search(rx, titulo, re.I)]
            if not temas:
                continue
            vistos.add(chave)
            try:
                quando = email.utils.parsedate_to_datetime(it.findtext("pubDate")).astimezone(dt.timezone.utc)
            except Exception:
                continue
            itens.append({"t": titulo, "url": it.findtext("link"), "fonte": fonte, "regiao": regiao, "temas": temas,
                          "peso": max(PESO_TEMA[t] for t in temas), "quando": quando.strftime("%Y-%m-%dT%H:%M:%SZ")})
    agora = dt.datetime.now(dt.timezone.utc)
    itens = [x for x in itens if (agora - dt.datetime.strptime(x["quando"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)).total_seconds() < 36 * 3600]
    itens.sort(key=lambda x: x["quando"], reverse=True)
    return itens[:40]


if __name__ == "__main__":
    os.makedirs(SAIDA, exist_ok=True)
    agora = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cot = []
    for f in (boi_py, boi_sp, bezerro, lambda: b3("BGI", "BGI", "R$/@"), lambda: b3("CCM", "CCM", "R$/saca"), cme, bcp, brl):
        try:
            cot.append(f())
        except Exception as e:
            print("cotação falhou:", getattr(f, "__name__", "b3"), e, file=sys.stderr)
    # cotações que falharam agora ficam com o último valor publicado (marcado como antigo)
    try:
        velho = jbaixar("https://raw.githubusercontent.com/lucasmoller9646/mercado-boi/dados/cotacoes.json")
        tem = {c["id"] for c in cot}
        for c in velho.get("itens", []):
            if c["id"] not in tem:
                c["antigo"] = True
                cot.append(c)
    except Exception:
        pass
    ordem = ["boi", "boisp", "bezerro", "bgi", "ccm", "cme", "pyg", "brl"]
    cot.sort(key=lambda c: ordem.index(c["id"]) if c["id"] in ordem else 99)
    with open(os.path.join(SAIDA, "cotacoes.json"), "w", encoding="utf-8") as f:
        json.dump({"atualizado": agora, "itens": cot}, f, ensure_ascii=False, indent=1)
    nts = noticias()
    with open(os.path.join(SAIDA, "noticias.json"), "w", encoding="utf-8") as f:
        json.dump({"atualizado": agora, "itens": nts}, f, ensure_ascii=False, indent=1)
    print("cotações:", [c["id"] for c in cot], "· notícias:", len(nts))
    sys.exit(0 if cot or nts else 1)

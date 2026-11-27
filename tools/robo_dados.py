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
    return {"id": "cme", "rot": "CME " + cod[2:], "val": v, "dec": 0, "un": "¢/bushel", "var": var(v, a), "quando": hora_yahoo(m), "fonte": "Milho em Chicago"}


def hora_yahoo(m):
    t = m.get("regularMarketTime")
    return dt.datetime.fromtimestamp(t, ASU).strftime("%Y-%m-%d %H:%M") if t else None


def brl():
    """Dólar comercial: Yahoo (BRL=X) e, se falhar, AwesomeAPI (que costuma responder 429 às máquinas do GitHub)."""
    try:
        m = jbaixar("https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?range=5d&interval=1d")["chart"]["result"][0]["meta"]
        v, a = m.get("regularMarketPrice"), m.get("chartPreviousClose") or m.get("previousClose")
        if v:
            return {"id": "brl", "rot": "R$/US$", "val": v, "dec": 3, "un": "R$ por dólar", "var": var(v, a), "quando": hora_yahoo(m), "fonte": "Dólar comercial"}
    except Exception as e:
        print("brl pelo Yahoo falhou:", e, file=sys.stderr)
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
# O Google Notícias não tem edição do Paraguai: gl=PY cai na edição latino-americana (dólar de cada país).
# Por isso a consulta do Paraguai exige Paraguay/guaraní/BCP e o filtro exige jornal .py ou "Paraguay" no título.
CONSULTAS = [
    ("Paraguai", "es-419", "US", "US:es-419",
     '(dólar OR "tipo de cambio" OR divisas OR inflación OR BCP OR "Banco Central del Paraguay" OR "política monetaria") (Paraguay OR guaraní OR BCP) when:2d'),
    ("EUA", "en-US", "US", "US:en",
     '(Fed OR FOMC OR "Federal Reserve" OR CPI OR PCE OR payrolls OR "jobs report" OR "Treasury yields" OR "dollar index") when:1d'),
    ("Brasil", "pt-BR", "BR", "BR:pt-419", '(dólar OR Copom OR Selic OR IPCA OR "Banco Central" OR Galípolo) when:1d'),
]
LIMITE = {"Paraguai": 16, "EUA": 12, "Brasil": 8}
TEMAS = [
    ("Fed", r"\bfed\b|fomc|fed chair|federal reserve|reserva federal"),
    ("BCP", r"\bbcp\b|banco central del paraguay"),
    ("Inflação", r"\bcpi\b|\bpce\b|\bipc\b|ipca|inflaci|inflation|inflação|precios al consumidor"),
    ("Juros", r"selic|copom|tasa de pol|política monetari|interest rate|rate cut|rate hike|juros|treasury|yields"),
    ("Emprego", r"payroll|nonfarm|jobs report|desemprego|desempleo|unemployment"),
    ("Câmbio", r"d[óo]lar|dollar|greenback|\bdxy\b|tipo de cambio|cambiari|câmbio|divisas|guaraní|\bpyg\b"),
]
PESO_TEMA = {"Fed": 3, "BCP": 3, "Inflação": 2, "Juros": 2, "Emprego": 2, "Câmbio": 1}
# o que não mexe com o câmbio do guaraní: dólar de outros países, outras moedas, esporte, carro, polícia
RUIDO = (r"hoy en (bolivia|colombia|chile|per[úu]|uruguay|m[ée]xico|argentina|venezuela|rep[úu]blica dominicana|honduras|guatemala|"
         r"costa rica|nicaragua|ecuador|el salvador|panam[áa]|cuba|espa[ñn]a|brasil)|peso (mexicano|colombiano|chileno|argentino|uruguayo)|"
         r"\bblue\b|\bmep\b|colones|\bsoles\b|\bwon\b|surcoreano|\byen\b|iene|rupee|rupia|canad|australian|aussie|\bkiwi\b|yuan|sterling|"
         r"\bgold\b|\boro\b|\bouro\b|bitcoin|cripto|black friday|minimum wage|salário mínimo|"
         r"f[úu]tbol|\bclub\b|torneo|partido|\bgol\b|mitre|aeropuerto|armas|prisi[óo]n|arresto|domiciliario|\bjuez\b|fiscal[íi]a|senabico|"
         r"câmbio (manual|automático)|\bcarro|veículo|\bcv\b|\bgolf\b|melhores apps|ao vivo|onde comprar|\bpix\b")
JORNAIS_PY = ("ultimahora.com", "lanacion.com.py", "abc.com.py", "5dias.com.py", "hoy.com.py", "npy.com.py", "marketdata.com.py",
              "infonegocios.com.py", "elnacional.com.py", "latribuna.com.py", "independiente.com.py", "rdn.com.py", "bcp.gov.py")
EUA_ANCORA = r"\bfed\b|fomc|federal reserve|treasur|\bcpi\b|\bpce\b|payroll|nonfarm|jobs report|dollar index|\bdxy\b|u\.?s\.? dollar|greenback|u\.?s\.? (inflation|economy|consumer|jobs)"


def relevante(regiao, titulo, site):
    """Fica a manchete que é da região certa e fala de câmbio, juros, inflação ou emprego, sem o ruído conhecido."""
    if re.search(RUIDO, titulo, re.I):
        return False
    if regiao == "Paraguai":
        doPY = site.endswith(".py") or any(site.endswith(j) for j in JORNAIS_PY) or re.search(r"paragua", titulo, re.I)
        financas = re.search(r"d[óo]lar|tipo de cambio|cambiari|divisas|inflaci|\bipc\b|\btasas?\b|\bbcp\b|banco central|"
                             r"reservas|dep[óo]sitos|sistema financiero|bonos|encaje|pol[íi]tica monetaria|exportaci|importaci", titulo, re.I)
        return bool(doPY and financas)
    if regiao == "EUA":
        return bool(re.search(EUA_ANCORA, titulo, re.I) or re.search(r"\binflation\b", titulo, re.I) and re.search(r"\bu\.?s\.?\b|americans?|fed", titulo, re.I))
    return True


def noticias():
    itens, vistos = [], set()
    agora = dt.datetime.now(dt.timezone.utc)
    for regiao, hl, gl, ceid, q in CONSULTAS:
        url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": hl, "gl": gl, "ceid": ceid})
        try:
            raiz = ET.fromstring(baixar(url))
        except Exception as e:
            print("notícias", regiao, "falhou:", e, file=sys.stderr)
            continue
        daRegiao = []
        for it in raiz.iter("item"):
            titulo = (it.findtext("title") or "").strip()
            fonte = (it.findtext("source") or "").strip()
            if fonte and titulo.endswith(" - " + fonte):
                titulo = titulo[: -len(" - " + fonte)]
            src = it.find("source")
            site = urllib.parse.urlparse(src.get("url") if src is not None else "").netloc.lower()
            chave = re.sub(r"\W+", "", titulo.lower())[:80]
            if not titulo or chave in vistos or not relevante(regiao, titulo, site):
                continue
            temas = [n for n, rx in TEMAS if re.search(rx, titulo, re.I)]
            if not temas:
                continue
            try:
                quando = email.utils.parsedate_to_datetime(it.findtext("pubDate")).astimezone(dt.timezone.utc)
            except Exception:
                continue
            if (agora - quando).total_seconds() > 36 * 3600:
                continue
            vistos.add(chave)
            daRegiao.append({"t": titulo, "url": it.findtext("link"), "fonte": fonte, "regiao": regiao, "temas": temas,
                             "peso": max(PESO_TEMA[t] for t in temas), "quando": quando.strftime("%Y-%m-%dT%H:%M:%SZ")})
        daRegiao.sort(key=lambda x: x["quando"], reverse=True)
        itens += daRegiao[: LIMITE.get(regiao, 12)]
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

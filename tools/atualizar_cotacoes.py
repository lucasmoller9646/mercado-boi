#!/usr/bin/env python3
"""Robô do repositório (GitHub Actions): guarda, dia a dia, o Indicador do Boi DATAGRO (primitiva pública)
e as cotações do milho em Chicago (CME), que o navegador não consegue buscar sozinho.

Escreve data/boi_br_diario.json e data/cme_milho.json. Só usa endereços públicos, sem credencial.
"""
import json, os, sys, datetime as dt, urllib.request, urllib.error

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (mercado-boi; +https://lucasmoller9646.github.io/mercado-boi/)"}


def pegar(url, tempo=30, tentativas=3):
    """Busca JSON; diante de 429 (limite de acessos) espera o tempo que o servidor pede e tenta de novo, poucas vezes."""
    import time, urllib.error
    for k in range(tentativas):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=tempo) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == tentativas - 1:
                raise
            espera = e.headers.get("Retry-After")
            time.sleep(min(120, int(espera)) if espera and espera.isdigit() else 30 * (k + 1))


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


ASU = dt.timezone(dt.timedelta(hours=-3))


def historico_dolar(desde):
    """Fechamento diário do dólar comercial (R$ por US$) desde a data pedida: {AAAA-MM-DD: valor}.
    Yahoo (BRL=X) primeiro; a AwesomeAPI costuma responder 429 às máquinas do GitHub e fica de reserva."""
    serie = {}
    try:
        p1 = int(dt.datetime.combine(desde - dt.timedelta(days=10), dt.time(), dt.timezone.utc).timestamp())
        p2 = int(dt.datetime.now(dt.timezone.utc).timestamp()) + 86400
        r = pegar("https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?period1=%d&period2=%d&interval=1d" % (p1, p2))["chart"]["result"][0]
        fech = (r.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
        desloc = (r.get("meta") or {}).get("gmtoffset") or 0  # o dia do Yahoo é o dia de Londres (no verão, 23h UTC da véspera)
        for t, v in zip(r.get("timestamp") or [], fech):
            if v and 3 < v < 10:
                serie[dt.datetime.fromtimestamp(t + desloc, dt.timezone.utc).date().isoformat()] = round(v, 4)
    except Exception as e:
        print("dólar pelo Yahoo falhou:", e, file=sys.stderr)
    if not serie:
        dias = min(360, (dt.date.today() - desde).days + 15)
        for x in pegar("https://economia.awesomeapi.com.br/json/daily/USD-BRL/%d" % dias):
            serie[dt.datetime.fromtimestamp(int(x["timestamp"]), ASU).date().isoformat()] = round(float(x["bid"]), 4)
    return serie


def dolar_em(serie, dia):
    """Dólar do próprio dia; se o dia não tiver cotação (feriado), o último dia anterior que tiver."""
    ds = sorted(d for d in serie if d <= dia)
    return serie[ds[-1]] if ds else None


def boi_datagro():
    arq = ler("boi_br_diario.json", {"fonte": "", "pontos": []})
    pts = {x["d"]: x for x in arq.get("pontos", [])}
    novo = None
    try:
        prim = pegar("https://precos.api.datagro.com/dados?a=D_PEPR_SP_BR")
        p = prim[0] if isinstance(prim, list) else prim
        dia, ult = str(p.get("dia", ""))[:10], p.get("ult")
        if not dia or not isinstance(ult, (int, float)) or ult <= 0:
            raise ValueError("primitiva sem dia ou preço")
        antes = pts.get(dia)
        pts[dia] = {"d": dia, "rs": ult, "var": p.get("var"), "brl": antes.get("brl") if antes and antes.get("rs") == ult else None}
        novo = (dia, ult)
    except Exception as e:
        print("primitiva da DATAGRO falhou:", e, file=sys.stderr)
    # dólar do dia para todo ponto que ainda não tem (inclui a série histórica que veio da DATAGRO)
    faltam = sorted(d for d, x in pts.items() if not x.get("brl"))
    if faltam:
        serie = historico_dolar(dt.date.fromisoformat(faltam[0]))
        for d in faltam:
            pts[d]["brl"] = dolar_em(serie, d)
    if novo is None and not faltam:
        raise ValueError("nada novo")
    arq["pontos"] = [pts[k] for k in sorted(pts)]
    return gravar("boi_br_diario.json", arq), novo, len(faltam)


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

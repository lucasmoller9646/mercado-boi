/* Mercado do Boi — contas puras (sem DOM). Funciona no navegador (window.Calc) e no Node (testes). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Calc = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------------------------------------------------------------- utilidades
  const MESES = { jan: 1, ene: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8,
    set: 9, sep: 9, sept: 9, out: 10, oct: 10, nov: 11, dez: 12, dic: 12, dec: 12 };
  const p2 = (n) => String(n).padStart(2, "0");
  const iso = (a, m, d) => a + "-" + p2(m) + "-" + p2(d);

  /** Converte o que vier (Date, ISO, "Date(2026,10,25)", dd/mm/aaaa, "17-Nov.-26") em "aaaa-mm-dd" ou null. */
  function data(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date) return isNaN(v) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    const s = String(v).trim();
    let m = /^Date\((\d+),(\d+),(\d+)/.exec(s);
    if (m) return iso(+m[1], +m[2] + 1, +m[3]);
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/.exec(s);
    if (m) return iso(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
    m = /^(\d{1,2})[-\s\/]([A-Za-zçÇ]{3,4})\.?[-\s\/](\d{2,4})$/.exec(s);
    if (m) {
      const mes = MESES[m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
      if (mes) return iso(+m[3] < 100 ? 2000 + +m[3] : +m[3], mes, +m[1]);
    }
    return null;
  }

  /** Número a partir de célula: aceita número, "1.839.700,00" (es/pt), "$1,136.10" (us), "55.90%". loc = "es" | "us". */
  function num(v, loc) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s || /^#|^-$/.test(s)) return null;
    const pct = s.indexOf("%") >= 0;
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[$\s]/g, ""));
    s = s.replace(/[^\d.,]/g, "");
    if (!s) return null;
    const temP = s.indexOf(".") >= 0, temV = s.indexOf(",") >= 0;
    if (temP && temV) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (temV) {
      s = loc === "us" ? s.replace(/,/g, "") : (/^\d{1,3}(,\d{3})+$/.test(s) && loc !== "es" ? s.replace(/,/g, "") : s.replace(",", "."));
    } else if (temP) {
      if (loc === "es" && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    }
    let n = parseFloat(s);
    if (!isFinite(n)) return null;
    if (neg) n = -n;
    return pct ? n / 100 : n;
  }

  const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  function mediaPond(vals, pesos) {
    let s = 0, w = 0;
    for (let i = 0; i < vals.length; i++) if (vals[i] != null && isFinite(vals[i]) && pesos[i] > 0) { s += vals[i] * pesos[i]; w += pesos[i]; }
    return w > 0 ? s / w : null;
  }
  /** Quantil por interpolação linear (igual ao PERCENTIL.INC do Excel). */
  function quantil(ordenado, q) {
    const n = ordenado.length;
    if (!n) return null;
    const pos = (n - 1) * q, i = Math.floor(pos), f = pos - i;
    return i + 1 < n ? ordenado[i] + f * (ordenado[i + 1] - ordenado[i]) : ordenado[i];
  }
  const mesDe = (d) => d.slice(0, 7);
  const anoDe = (d) => +d.slice(0, 4);
  function somaDias(d, n) { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function difDias(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5); }
  function segundaDe(d) { const t = new Date(d + "T12:00:00Z"); const k = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - k); return t.toISOString().slice(0, 10); }
  function mesesEntre(a, b) { const out = []; let [y, m] = a.split("-").map(Number); const [y2, m2] = b.split("-").map(Number);
    while (y < y2 || (y === y2 && m <= m2)) { out.push(y + "-" + p2(m)); m++; if (m > 12) { m = 1; y++; } } return out; }

  /** Série {d:[datas ordenadas], v:[valores]} → função valor na data (último valor conhecido até a data). */
  function ultimoAte(datas, valores) {
    return function (d) {
      let lo = 0, hi = datas.length - 1, r = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (datas[mid] <= d) { r = mid; lo = mid + 1; } else hi = mid - 1; }
      return r >= 0 ? valores[r] : (valores.length ? valores[0] : null);
    };
  }

  /** Média por mês: linhas [{d, v, w?}] → Map mes → média (ponderada se houver w). */
  function porMes(linhas) {
    const acc = new Map();
    for (const l of linhas) {
      if (l.v == null || !isFinite(l.v) || !l.d) continue;
      const k = mesDe(l.d), w = l.w > 0 ? l.w : 1;
      const a = acc.get(k) || { s: 0, w: 0, n: 0 };
      a.s += l.v * w; a.w += w; a.n++; acc.set(k, a);
    }
    const out = new Map();
    for (const [k, a] of acc) out.set(k, a.s / a.w);
    return out;
  }

  /** Preenche meses sem dado: interpolação linear entre vizinhos; pontas repetem o mais próximo. Devolve {v:[], est:[bool]}. */
  function preencher(meses, mapa) {
    const v = meses.map((m) => (mapa.has(m) ? mapa.get(m) : null));
    const est = v.map((x) => x == null);
    const idx = v.map((x, i) => (x != null ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return { v, est };
    for (let i = 0; i < v.length; i++) {
      if (v[i] != null) continue;
      let a = -1, b = -1;
      for (const j of idx) { if (j < i) a = j; else if (j > i) { b = j; break; } }
      if (a >= 0 && b >= 0) v[i] = v[a] + ((v[b] - v[a]) * (i - a)) / (b - a);
      else v[i] = v[a >= 0 ? a : b];
    }
    return { v, est };
  }

  // ---------------------------------------------------------------- basis sazonal
  /** linhas [{d, b}] → por mês do ano (1..12): {n, qmin, q25, med, q75, qmax, media}. anos = últimos N anos (0 = tudo). */
  function basisSazonal(linhas, qmin, qmax, anos, hoje) {
    const corte = anos > 0 && hoje ? (anoDe(hoje) - anos) + hoje.slice(4) : "0000";
    const baldes = Array.from({ length: 12 }, () => []);
    for (const l of linhas) if (l.b != null && isFinite(l.b) && l.d >= corte) baldes[+l.d.slice(5, 7) - 1].push(l.b);
    return baldes.map((a, i) => {
      a.sort((x, y) => x - y);
      return { mes: i + 1, n: a.length, qmin: quantil(a, qmin), q25: quantil(a, 0.25), med: quantil(a, 0.5), q75: quantil(a, 0.75), qmax: quantil(a, qmax), media: media(a) };
    });
  }

  // ---------------------------------------------------------------- reposição: α e β
  /** Preço por kg previsto pelo indicador: p(w) = β·(1 + c/w) = β + α/w. */
  const precoKg = (beta, c, w) => beta * (1 + c / w);
  /** Desvio (em log) de um negócio contra o indicador da semana. Negativo = comprou abaixo do mercado. */
  const desvio = (pkg, beta, c, w) => (pkg > 0 && beta > 0 && w > 0 ? Math.log(pkg / precoKg(beta, c, w)) : null);
  /** Mínimos quadrados V = α + β·w (para conferência e para quando a aba INDICADOR não vier). */
  function mqo(xs, ys) {
    const n = xs.length; if (n < 3) return null;
    const mx = media(xs), my = media(ys);
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
    if (!sxx) return null;
    const beta = sxy / sxx, alfa = my - beta * mx;
    return { alfa, beta, r2: syy ? (sxy * sxy) / (sxx * syy) : null, n };
  }

  // ---------------------------------------------------------------- lucratividade (planilha Rentabilidade do Invernista)
  const PADRAO = {
    // preços (variam com o mercado)
    desmamante: 24000, toreton: 19000, fatorToretonGordo: 18500 / 19000, cambio: 6460, venda: 5.8,
    juros: 0.065,
    recria: { pesoIni: 180, gmd: 0.49, dias: 305, quebra: 0.04, custoMes: 12, outros: 20, mortAnual: 0.015 },
    rip: { gmd: 1.0, dias: 60, quebra: 0.04, diaria: 1.39, consumo: 5.33, outros: 20, mort: 0.003 },
    conf: { gmd: 1.45, dias: 120, rcIni: 0.5, rcFin: 0.563, quebra: 0.04, custoNutr: 0.29, consumo: 10.5, gastosOp: 0.4, outros: 20, mort: 0.005 },
    prazoRecebimento: 30,
  };

  /** TIR de fluxos datados em dias (igual ao XTIR do Excel). fluxos = [{dia, valor}]. */
  function xtir(fluxos) {
    const f = (r) => fluxos.reduce((s, x) => s + x.valor / Math.pow(1 + r, x.dia / 365), 0);
    let lo = -0.99, hi = 10, flo = f(lo), fhi = f(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (Math.abs(fm) < 1e-9) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  /** Motor da aba "Recria e Engorda": três etapas encadeadas + visão global. Valores em US$ por cabeça. */
  function lucratividade(p) {
    const j = p.juros, cb = p.cambio;
    const toretonGordo = p.toretonGordo != null ? p.toretonGordo : p.toreton * p.fatorToretonGordo;
    // ---- recria a pasto
    const r = p.recria, R = {};
    R.pesoIni = r.pesoIni; R.pesoFim = r.pesoIni + r.dias * r.gmd; R.dias = r.dias;
    R.receita = ((1 - r.mortAnual) * R.pesoFim * p.toreton * (1 - r.quebra)) / cb;
    R.compra = (r.pesoIni * p.desmamante) / cb;
    R.producao = (r.custoMes * r.dias) / 30.5;
    R.financeiro = R.compra * j * (r.dias / 365);
    R.outros = r.outros;
    // ---- RIP (pré-confinamento)
    const i = p.rip, I = {};
    I.pesoIni = R.pesoFim; I.pesoFim = I.pesoIni + i.dias * i.gmd; I.dias = i.dias;
    I.consumoPV = i.consumo / (I.pesoIni + I.pesoFim);
    I.receita = ((1 - i.mort) * I.pesoFim * toretonGordo * (1 - i.quebra)) / cb;
    I.compra = (I.pesoIni * p.toreton * (1 - i.quebra)) / cb;
    I.producao = i.diaria * i.dias;
    I.financeiro = j * I.compra * (i.dias / 365);
    I.outros = i.outros;
    // ---- confinamento
    const c = p.conf, C = {};
    C.pesoIni = I.pesoFim; C.pesoFim = C.pesoIni + c.gmd * c.dias; C.dias = c.dias;
    C.carcFim = C.pesoFim * c.rcFin; C.arrobas = C.carcFim / 15; C.carcIni = C.pesoIni * c.rcIni;
    C.gdc = (C.carcFim - C.carcIni) / c.dias;
    C.receita = p.venda * C.carcFim * (1 - c.mort);
    C.compra = (C.pesoIni * toretonGordo * (1 - c.quebra)) / cb;
    C.nutricional = c.custoNutr * c.consumo * c.dias;
    C.operacional = c.gastosOp * c.dias;
    C.financeiro = C.compra * j * (c.dias / 365);
    C.outros = c.outros;
    C.custoKgProd = (C.nutricional + C.operacional + C.outros) / (C.carcFim - C.carcIni);
    for (const E of [R, I]) E.custos = E.compra + E.producao + E.financeiro + E.outros;
    C.custos = C.compra + C.nutricional + C.operacional + C.financeiro + C.outros;
    for (const E of [R, I, C]) {
      E.lucro = E.receita - E.custos;
      E.lucroAno = E.lucro * (365 / E.dias);
      E.tir = Math.pow(1 + E.lucro / E.custos, 365 / E.dias) - 1;
      E.margem = E.receita / E.custos - 1;
    }
    // ---- global (ciclo completo, sem as transferências internas)
    const G = {};
    G.ciclo = R.dias + I.dias + C.dias + p.prazoRecebimento;
    G.fluxos = [
      { evento: "Recria", dia: 0, valor: -R.custos },
      { evento: "RIP", dia: R.dias, valor: -(I.producao + I.financeiro + I.outros) },
      { evento: "Confinamento", dia: R.dias + I.dias, valor: -(C.nutricional + C.operacional + C.financeiro + C.outros) },
      { evento: "Venda", dia: G.ciclo, valor: C.receita },
    ];
    G.lucro = G.fluxos.reduce((s, x) => s + x.valor, 0);
    G.investido = -G.fluxos.filter((x) => x.valor < 0).reduce((s, x) => s + x.valor, 0);
    G.tir = xtir(G.fluxos);
    G.lucroAno = G.lucro * (365 / G.ciclo);
    // preço de venda que zera o lucro global (US$/kg carcaça)
    G.pontoEquilibrio = G.investido / (C.carcFim * (1 - c.mort));
    return { recria: R, rip: I, conf: C, global: G, toretonGordo, entrada: p };
  }

  // ---------------------------------------------------------------- análise técnica (câmbio)
  function mediana(a) { const b = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); return quantil(b, 0.5); }
  /** Média móvel simples; posições sem janela completa ficam null. */
  function mms(v, n) {
    const out = new Array(v.length).fill(null); let s = 0;
    for (let i = 0; i < v.length; i++) { s += v[i]; if (i >= n) s -= v[i - n]; if (i >= n - 1) out[i] = s / n; }
    return out;
  }
  /** Índice de força relativa de Wilder. */
  function ifr(v, n) {
    const out = new Array(v.length).fill(null); if (v.length <= n) return out;
    let g = 0, p = 0;
    for (let i = 1; i <= n; i++) { const d = v[i] - v[i - 1]; if (d > 0) g += d; else p -= d; }
    g /= n; p /= n; out[n] = p === 0 ? 100 : 100 - 100 / (1 + g / p);
    for (let i = n + 1; i < v.length; i++) { const d = v[i] - v[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; p = (p * (n - 1) + Math.max(-d, 0)) / n; out[i] = p === 0 ? 100 : 100 - 100 / (1 + g / p); }
    return out;
  }
  /** Picos e vales (zigue-zague): um extremo só é confirmado depois de uma reversão de pelo menos `limiar` (fração).
      Devolve [{i, v, tipo: "pico" | "vale", confirmado}] — o último é o extremo em formação. */
  function picosVales(v, limiar) {
    const out = []; if (v.length < 3) return out;
    let dir = 0, iExt = 0, iMax = 0, iMin = 0;
    for (let i = 1; i < v.length; i++) {
      if (dir === 0) {
        if (v[i] > v[iMax]) iMax = i; if (v[i] < v[iMin]) iMin = i;
        if (v[i] >= v[iMin] * (1 + limiar)) { out.push({ i: iMin, v: v[iMin], tipo: "vale", confirmado: true }); dir = 1; iExt = i; }
        else if (v[i] <= v[iMax] * (1 - limiar)) { out.push({ i: iMax, v: v[iMax], tipo: "pico", confirmado: true }); dir = -1; iExt = i; }
      } else if (dir === 1) {
        if (v[i] > v[iExt]) iExt = i;
        else if (v[i] <= v[iExt] * (1 - limiar)) { out.push({ i: iExt, v: v[iExt], tipo: "pico", confirmado: true }); dir = -1; iExt = i; }
      } else {
        if (v[i] < v[iExt]) iExt = i;
        else if (v[i] >= v[iExt] * (1 + limiar)) { out.push({ i: iExt, v: v[iExt], tipo: "vale", confirmado: true }); dir = 1; iExt = i; }
      }
    }
    if (dir !== 0) out.push({ i: iExt, v: v[iExt], tipo: dir === 1 ? "pico" : "vale", confirmado: false });
    return out;
  }

  /** Mínimos quadrados ponderados V = α + β·w (pesos = cabeças do lote). */
  function mqoPond(xs, ys, ws) {
    let sw = 0, sx = 0, sy = 0;
    for (let i = 0; i < xs.length; i++) { const w = ws[i] > 0 ? ws[i] : 0; sw += w; sx += w * xs[i]; sy += w * ys[i]; }
    if (!(sw > 0) || xs.length < 3) return null;
    const mx = sx / sw, my = sy / sw; let sxx = 0, sxy = 0;
    for (let i = 0; i < xs.length; i++) { const w = ws[i] > 0 ? ws[i] : 0; sxx += w * (xs[i] - mx) ** 2; sxy += w * (xs[i] - mx) * (ys[i] - my); }
    if (!sxx) return null;
    const beta = sxy / sxx;
    return { alfa: my - beta * mx, beta, n: xs.length, peso: sw };
  }
  /** Média móvel exponencial (semente = primeiro valor). */
  function mme(v, n) { const k = 2 / (n + 1), out = []; let e = null; for (let i = 0; i < v.length; i++) { e = e == null ? v[i] : v[i] * k + e * (1 - k); out.push(e); } return out; }
  /** MACD clássico (12, 26, 9): devolve {macd, sinal, hist} (arrays). */
  function macd(v, r, l, s) {
    const a = mme(v, r || 12), b = mme(v, l || 26), m = a.map((x, i) => x - b[i]), sg = mme(m, s || 9);
    return { macd: m, sinal: sg, hist: m.map((x, i) => x - sg[i]) };
  }
  /** Bandas de Bollinger (n, k desvios) no último ponto: {media, sup, inf, pctB}. */
  function bollinger(v, n, k) {
    n = n || 20; k = k || 2; if (v.length < n) return null;
    const j = v.slice(-n), m = media(j), dp = Math.sqrt(j.reduce((t, x) => t + (x - m) ** 2, 0) / n), sup = m + k * dp, inf = m - k * dp;
    return { media: m, sup, inf, pctB: sup > inf ? (v[v.length - 1] - inf) / (sup - inf) : 0.5 };
  }
  /** Projeção estatística (leque): passeio aleatório com a tendência recente amortecida.
      deriva diária = média dos retornos de `nTend` pregões, cortada pela metade a cada `meiaVida` pregões;
      incerteza = desvio-padrão dos retornos de `nVol` pregões × √horizonte. Devolve um ponto por pregão à frente. */
  function projetar(fech, h, opc) {
    opc = opc || {}; const nVol = opc.nVol || 60, nTend = opc.nTend || 20, meia = opc.meiaVida || 10;
    if (fech.length < Math.max(nVol, nTend) + 1) return null;
    const ret = []; for (let i = 1; i < fech.length; i++) ret.push(Math.log(fech[i] / fech[i - 1]));
    const rv = ret.slice(-nVol), mv = media(rv), sd = Math.sqrt(rv.reduce((t, x) => t + (x - mv) ** 2, 0) / (rv.length - 1)), mt = media(ret.slice(-nTend));
    const ult = fech[fech.length - 1], out = []; let acum = 0;
    for (let k = 1; k <= h; k++) {
      acum += mt * Math.pow(0.5, k / meia); const s = sd * Math.sqrt(k), c = ult * Math.exp(acum);
      out.push({ k, med: c, i50: c * Math.exp(-0.6745 * s), s50: c * Math.exp(0.6745 * s), i80: c * Math.exp(-1.2816 * s), s80: c * Math.exp(1.2816 * s) });
    }
    return { pontos: out, volDia: sd, tendDia: mt };
  }

  // ---------------------------------------------------------------- lucratividade Ypoti (método da conta manual, "Rentabilidade Histórica")
  /** Padrões da conta manual: recria (com a RIP dentro) a custo fixo por cabeça, sem juros, quebra nem mortalidade. */
  const PADRAO_YPOTI = { pesoIni: 180, custoRecria: 100, diasRecria: 365, desmamante: 24000, toreton: 19000, cambio: 6460, venda: 5.8,
    pesoEntrada: 360, pesoSaida: 523, rc: 0.566, dias: 118, diaria: 2.7 };

  /** Conta da apresentação "Rentabilidade Histórica" (US$/cab):
      recria = peso de entrada no confinamento × toretón − 180 kg × desmamante (÷ câmbio) − custo fixo da recria;
      confinamento = peso de saída × RC × preço de venda − dias × diária − peso de entrada × toretón ÷ câmbio. */
  function lucroYpoti(p) {
    const fx = p.cambio, R = {}, K = {}, G = {};
    R.pesoIni = p.pesoIni; R.pesoFim = p.pesoEntrada; R.dias = p.diasRecria;
    R.compra = (p.pesoIni * p.desmamante) / fx; R.custo = p.custoRecria; R.receita = (p.pesoEntrada * p.toreton) / fx;
    R.lucro = R.receita - R.compra - R.custo; R.investido = R.compra + R.custo;
    R.tir = R.investido > 0 && R.receita > 0 && R.dias > 0 ? Math.pow(R.receita / R.investido, 365 / R.dias) - 1 : null;
    K.pesoIni = p.pesoEntrada; K.pesoFim = p.pesoSaida; K.dias = p.dias; K.kgCarc = p.pesoSaida * p.rc;
    K.compra = R.receita; K.engorda = p.dias * p.diaria; K.receita = K.kgCarc * p.venda;
    K.lucro = K.receita - K.compra - K.engorda; K.investido = K.compra + K.engorda;
    K.tir = K.investido > 0 && K.receita > 0 && K.dias > 0 ? Math.pow(K.receita / K.investido, 365 / K.dias) - 1 : null;
    K.equilibrio = K.kgCarc > 0 ? K.investido / K.kgCarc : null;
    K.custoKgGanho = p.pesoSaida > p.pesoEntrada ? K.engorda / (p.pesoSaida - p.pesoEntrada) : null;
    G.lucro = R.lucro + K.lucro; G.ciclo = R.dias + K.dias; G.investido = R.investido + K.engorda;
    G.fluxos = [{ evento: "Compra do desmamante e custo da recria", dia: 0, valor: -R.investido },
      { evento: "Custo de engorda no confinamento", dia: R.dias, valor: -K.engorda },
      { evento: "Venda do gordo", dia: G.ciclo, valor: K.receita }];
    G.tir = xtir(G.fluxos); G.equilibrio = K.kgCarc > 0 ? G.investido / K.kgCarc : null;
    return { recria: R, conf: K, global: G, entrada: p };
  }

  /** Mínimos quadrados com várias variáveis (e pesos opcionais): X = [[x1, x2, ...]], y = [...]. Devolve os coeficientes ou null. */
  function mqoMulti(X, y, w) {
    const k = X.length ? X[0].length : 0; if (!k || X.length <= k) return null;
    const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
    for (let i = 0; i < X.length; i++) { const wi = w ? w[i] : 1; if (!(wi > 0) || !isFinite(y[i])) continue;
      for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += wi * X[i][a] * X[i][b]; A[a][k] += wi * X[i][a] * y[i]; } }
    for (let c = 0; c < k; c++) { let m = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
      if (Math.abs(A[m][c]) < 1e-12) return null; [A[c], A[m]] = [A[m], A[c]];
      for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j]; } }
    return A.map((lin, i) => lin[k] / lin[i]);
  }

  // ---------------------------------------------------------------- reposição: régua de 2º grau
  /** Régua alternativa à α + β·peso: valor por cabeça ÷ β da semana = k·peso + c + q·peso² (machos).
      Mantém o nível semanal (β) e a correção de fonte da régua da planilha e troca só a forma. Cada semana usa só lotes de semanas
      anteriores: 104 (ou 156 se houver menos de 250 lotes). Janelas menores deixam a curvatura instável (com uns 60 lotes de machos,
      o kg a mais chegava a valer negativo em 360 kg). Se a curva estimada der valor do kg a mais abaixo de 20% de β entre 150 e 420 kg,
      vale a curva anterior. Devolve Map semana → {k, c, q, n, janela}. */
  function reguaQuad(lotes, ind, opc) {
    opc = opc || {}; const curta = opc.curta || 104, longa = opc.longa || 156, minCurta = opc.minCurta || 250, minimo = opc.minimo || 120, minDp = opc.minDp || 20;
    const porSemana = new Map(ind.map((r) => [r.d, r]));
    const obs = [];
    for (const l of lotes) {
      if (l.sexo !== "Macho" || !(l.peso >= 60 && l.peso <= 450) || !(l.pkg >= 4000 && l.pkg <= 45000) || /resumo/i.test(l.tipo || "")) continue;
      const s = segundaDe(l.d), r = porSemana.get(s); if (!r || !(r.beta > 0)) continue;
      const fT = isFinite(r.fT) ? r.fT : 0, fI = isFinite(r.fI) ? r.fI : 0, fb = 0.25 * fT + 0.25 * fI;
      const fs = /tropeando/i.test(l.fonte) ? fT : /invernada/i.test(l.fonte) ? fI : 0;
      obs.push({ s, w: l.peso, y: l.pkg / (r.beta * Math.exp(fs - fb)) });
    }
    obs.sort((a, b) => (a.s < b.s ? -1 : 1));
    const out = new Map(); let ant = null;
    for (const r of ind) {
      if (opc.desde && r.d < opc.desde) continue;
      let jan = curta, ini = somaDias(r.d, -7 * curta), sel = obs.filter((o) => o.s >= ini && o.s < r.d);
      if (sel.length < minCurta) { jan = longa; ini = somaDias(r.d, -7 * longa); sel = obs.filter((o) => o.s >= ini && o.s < r.d); }
      const mw = media(sel.map((o) => o.w)), dp = sel.length > 1 ? Math.sqrt(sel.reduce((t, o) => t + (o.w - mw) ** 2, 0) / (sel.length - 1)) : 0;
      let b = sel.length >= minimo && dp >= minDp ? mqoMulti(sel.map((o) => [1, 1 / o.w, o.w]), sel.map((o) => o.y)) : null;
      const sao = b && b.every(isFinite) && b[0] + 2 * b[2] * 150 > 0.2 && b[0] + 2 * b[2] * 420 > 0.2;
      if (sao) { ant = { k: b[0], c: b[1], q: b[2], n: sel.length, janela: jan }; }
      if (ant) out.set(r.d, ant);
    }
    return out;
  }
  /** Com a régua de 2º grau: preço por kg, valor marginal do kg (derivada do valor por cabeça) e a razão entre os dois, num peso. */
  function pontoQuad(beta, g, w) { const p = beta * (g.k + g.c / w + g.q * w), b = beta * (g.k + 2 * g.q * w); return { p, b, razao: p > 0 ? b / p : null }; }

  /** Cópia funda simples dos parâmetros com substituições (obj de mesmo formato, só o que muda). */
  function mesclar(base, extra) {
    const o = JSON.parse(JSON.stringify(base));
    (function rec(dst, src) {
      for (const k in src) {
        if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) { dst[k] = dst[k] || {}; rec(dst[k], src[k]); }
        else if (src[k] != null && (typeof src[k] !== "number" || isFinite(src[k]))) dst[k] = src[k];
      }
    })(o, extra || {});
    return o;
  }

  return { data, num, media, mediaPond, quantil, mesDe, anoDe, somaDias, difDias, segundaDe, mesesEntre, ultimoAte, porMes, preencher,
    basisSazonal, precoKg, desvio, mqo, PADRAO, xtir, lucratividade, mesclar, mediana, mms, ifr, picosVales, mqoPond, mme, macd, bollinger, projetar, PADRAO_YPOTI, lucroYpoti, mqoMulti, reguaQuad, pontoQuad };
});

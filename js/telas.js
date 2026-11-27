/* Mercado do Boi — desenho das três telas (indicadores, gráficos ECharts e tabelas). */
(function () {
  "use strict";
  const C = window.Calc;
  const COR = { py: "#338ced", ypoti: "#e76624", br: "#00a888", amarelo: "#d28e05", magenta: "#e24d8b", violeta: "#9887ef",
    bom: "#0aac23", ruim: "#dc3c3d", tinta: "#EAF2EC", t2: "rgba(234,242,236,.74)", t3: "rgba(234,242,236,.5)",
    grade: "rgba(255,255,255,.07)", eixo: "rgba(255,255,255,.2)", faixa: "rgba(234,242,236,.16)",
    rampa: ["#9dc8f7", "#6aabf1", "#338ced", "#1b64be"] };
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const F = {
    n: (v, d) => (v == null || !isFinite(v) ? "–" : nf(d || 0).format(v)),
    pct: (v, d, sinal) => (v == null || !isFinite(v) ? "–" : (sinal && v > 0 ? "+" : "") + nf(d == null ? 1 : d).format(v * 100) + "%"),
    mesAno: (iso) => MES[+iso.slice(5, 7) - 1] + "/" + iso.slice(2, 4),
    dia: (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4),
  };
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
  const graficos = {}; // id → instância
  const opcoes = {};   // id → última opção (para reanimar ao entrar na tela)

  // ------------------------------------------------------------------ base dos gráficos
  function base(extra) {
    const r = rem();
    const o = {
      backgroundColor: "transparent", textStyle: { color: COR.t2, fontFamily: getComputedStyle(document.body).fontFamily, fontSize: r * 0.82 },
      animationDuration: 1100, animationEasing: "cubicOut", animationDurationUpdate: 600,
      grid: { left: r * 0.4, right: r * 3.6, top: r * 2.6, bottom: r * 0.3, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: r * 1.1, itemHeight: r * 0.28, itemGap: r * 0.9, icon: "roundRect", textStyle: { color: COR.t2, fontSize: r * 0.8 }, inactiveColor: COR.t3 },
      tooltip: { trigger: "axis", confine: true, backgroundColor: "rgba(10,28,19,.94)", borderColor: "rgba(255,255,255,.18)", borderWidth: 1,
        textStyle: { color: COR.tinta, fontSize: r * 0.82 }, axisPointer: { type: "line", lineStyle: { color: COR.eixo } }, extraCssText: "backdrop-filter:blur(12px);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.4)" },
    };
    return Object.assign(o, extra || {});
  }
  const eixoX = (extra) => Object.assign({ axisLine: { lineStyle: { color: COR.eixo } }, axisTick: { show: false }, axisLabel: { color: COR.t3, fontSize: rem() * 0.76, hideOverlap: true }, splitLine: { show: false } }, extra || {});
  const eixoY = (fmt, extra) => Object.assign({ type: "value", scale: true, axisLine: { show: false }, axisTick: { show: false }, splitNumber: 4,
    axisLabel: { color: COR.t3, fontSize: rem() * 0.76, formatter: fmt }, splitLine: { lineStyle: { color: COR.grade } } }, extra || {});
  const eixoTempo = (extra) => eixoX(Object.assign({ type: "time", axisLabel: { color: COR.t3, fontSize: rem() * 0.76, hideOverlap: true,
    formatter: { year: "{yyyy}", month: "{MMM}", day: "{d} {MMM}" } } }, extra || {}));
  function linha(nome, dados, cor, extra) {
    return Object.assign({ name: nome, type: "line", data: dados, showSymbol: false, symbol: "circle", symbolSize: rem() * 0.5, lineStyle: { width: 2, color: cor }, itemStyle: { color: cor },
      emphasis: { focus: "series" }, connectNulls: true }, extra || {});
  }
  const rotuloFim = (fmt, cor) => ({ endLabel: { show: true, formatter: (p) => fmt(Array.isArray(p.value) ? p.value[1] : p.value), color: COR.tinta, fontSize: rem() * 0.82, fontWeight: 600, distance: 6,
    backgroundColor: "rgba(6,19,12,.55)", padding: [2, 5], borderRadius: 5, borderColor: cor, borderWidth: 1 }, labelLayout: { moveOverlap: "shiftY" } });
  /** Faixa entre dois quantis em eixo de categorias (duas áreas empilhadas: base invisível + largura). */
  function faixa(nome, min, max) {
    return [
      { name: "_base", type: "line", data: min, stack: "faixa-" + nome, stackStrategy: "all", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, silent: true, tooltip: { show: false }, legendHoverLink: false },
      { name: nome, type: "line", data: max.map((v, i) => (v == null || min[i] == null ? null : v - min[i])), stack: "faixa-" + nome, stackStrategy: "all", symbol: "none",
        lineStyle: { opacity: 0 }, areaStyle: { color: COR.faixa }, itemStyle: { color: "rgba(234,242,236,.4)" }, silent: true, tooltip: { show: false } },
    ];
  }
  const linhaRef = (nome, valor, cor, fmt) => ({ name: nome, type: "line", data: [], itemStyle: { color: cor }, lineStyle: { color: cor, type: "dashed", width: 1.5 },
    markLine: { silent: true, symbol: "none", data: [{ yAxis: valor }], lineStyle: { color: cor, type: "dashed", width: 1.5 },
      label: { formatter: () => fmt(valor), color: COR.tinta, fontSize: rem() * 0.78, position: "insideEndTop", backgroundColor: "rgba(6,19,12,.55)", padding: [2, 4], borderRadius: 4 } } });

  function desenhar(id, opcao, vazio) {
    const el = document.getElementById(id);
    if (!el) return;
    const aviso = el.parentElement.querySelector(".vazio");
    if (!opcao) {
      if (graficos[id]) { graficos[id].dispose(); delete graficos[id]; delete opcoes[id]; }
      el.hidden = true; if (aviso) { aviso.hidden = false; aviso.textContent = vazio || "Sem dados para mostrar."; }
      return;
    }
    el.hidden = false; if (aviso) aviso.hidden = true;
    if (!graficos[id]) graficos[id] = echarts.init(el, null, { renderer: "canvas" });
    ajustarLegenda(el, opcao);
    opcoes[id] = opcao;
    graficos[id].setOption(opcao, true);
  }
  /** A legenda quebra em mais de uma linha em cartões estreitos: abre espaço na grade para ela não cobrir o eixo. */
  function ajustarLegenda(el, o) {
    if (!o.legend || o.legend.show === false) return;
    const r = rem(), nomes = (o.legend.data || o.series.filter((x) => x.name && x.name[0] !== "_").map((x) => x.name)).map((x) => (typeof x === "string" ? x : x.name));
    const unicos = [...new Set(nomes)], larg = unicos.reduce((t, n) => t + n.length * r * 0.43 + r * 2.5, 0), linhas = Math.max(1, Math.ceil(larg / Math.max(120, el.clientWidth - r)));
    const extra = (linhas - 1) * r * 1.35;
    if (!extra) return;
    if (Array.isArray(o.grid)) { o.grid.forEach((g) => { if (typeof g.top === "number") g.top += extra; }); (o.title || []).forEach((t) => { if (typeof t.top === "number") t.top += extra; }); }
    else if (o.grid && typeof o.grid.top === "number") o.grid.top += extra;
  }
  function reanimar(tela) {
    document.querySelectorAll("#tela-" + tela + " .grafico").forEach((el) => {
      const g = graficos[el.id];
      if (g && opcoes[el.id]) { g.resize(); g.clear(); g.setOption(opcoes[el.id], true); }
    });
  }
  function redimensionar() { for (const id in graficos) graficos[id].resize(); }

  // ------------------------------------------------------------------ indicadores (cartões de número)
  function kpis(id, itens) {
    const el = document.getElementById(id);
    el.innerHTML = itens.map((k) => {
      const d = k.delta != null && isFinite(k.delta) ? '<i class="delta ' + (k.delta > 0 ? "sobe" : k.delta < 0 ? "desce" : "") + (k.neutro ? " neutro" : "") + '">' + (k.delta > 0 ? "▲" : k.delta < 0 ? "▼" : "•") + " " + k.deltaTxt + "</i> " : "";
      if (k.texto != null) return '<div class="kpi vidro' + (k.destaque ? " destaque" : "") + '"><span class="r">' + k.rotulo + '</span><b class="v texto">' + k.texto + '</b><span class="nt">' + (k.nota || "") + "</span></div>";
      return '<div class="kpi vidro' + (k.destaque ? " destaque" : "") + '"><span class="r">' + k.rotulo + '</span><b class="v"><span class="num" data-v="' + (k.valor == null ? "" : k.valor) + '" data-d="' + (k.dec || 0) + '" data-p="' + (k.pct ? 1 : 0) + '" data-s="' + (k.sinal ? 1 : 0) + '">' +
        (k.pct ? F.pct(k.valor, k.dec, k.sinal) : (k.sinal && k.valor > 0 ? "+" : "") + F.n(k.valor, k.dec)) + "</span>" + (k.un ? "<small>" + k.un + "</small>" : "") + '</b><span class="nt">' + d + (k.nota || "") + "</span></div>";
    }).join("");
  }
  function contar(tela) { // animação de contagem dos números ao entrar na tela
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll("#tela-" + tela + " .kpi .num").forEach((el) => {
      const v = parseFloat(el.dataset.v); if (!isFinite(v)) return;
      const d = +el.dataset.d, p = el.dataset.p === "1", s = el.dataset.s === "1", t0 = performance.now(), dur = 900;
      const passo = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3), x = v * e;
        el.textContent = p ? F.pct(x, d, s) : (s && x > 0 ? "+" : "") + F.n(x, d); if (k < 1) requestAnimationFrame(passo); };
      requestAnimationFrame(passo);
    });
  }

  // ================================================================== TELA 1 — boi gordo e milho
  function telaGordo(M) {
    const b = M.boi, m = M.milho, f = b.frente, fm = m.frente;
    kpis("kpis-gordo", [
      { rotulo: "Novillo Paraguai · Valor Agro", valor: b.pyHoje, dec: 2, un: "US$/kg carcaça", delta: b.pySemana != null ? b.pyHoje - b.pySemana : null,
        neutro: true, deltaTxt: F.n(Math.abs(b.pyHoje - b.pySemana), 2) + " na semana", nota: b.dataVA ? "· " + F.dia(b.dataVA) : "" },
      { rotulo: "Nosso preço de venda", valor: b.vendaHoje, dec: 2, un: "US$/kg carcaça", destaque: true, delta: b.premio, deltaTxt: F.n(Math.abs(b.premio), 2) + " sobre o mercado",
        nota: b.vendaHoje != null ? "· " + b.vendaRef : "aguardando dados da Ypoti" },
      { rotulo: "Basis Paraguai × Brasil", valor: b.basisHoje, pct: true, dec: 1, sinal: true, nota: f ? "contra " + f.cod + " em dólar" : "sem cotação da B3" },
      { rotulo: "Boi gordo B3 · " + (f ? f.cod : "BGI"), valor: f ? f.reais : null, dec: 2, un: "R$/@", nota: f && f.usd ? "US$ " + F.n(f.usd, 2) + "/kg · Paraguai " + F.n(f.pyMin, 2) + " a " + F.n(f.pyMax, 2) : "" },
      { rotulo: "Milho B3 · " + (fm ? fm.cod : "CCM"), valor: fm ? fm.reais : null, dec: 2, un: "R$/saca", nota: fm && fm.usd ? "US$ " + F.n(fm.usd, 0) + "/t · Paraguai " + F.n(fm.pyMin, 0) + " a " + F.n(fm.pyMax, 0) : "" },
      { rotulo: "Nosso milho", valor: m.milhoHoje, dec: 0, un: "US$/t", destaque: true, nota: m.milhoHoje != null ? (m.basisNosso != null ? "basis " + F.n(m.basisNosso, 0) + " · " : "") + m.milhoRef : "aguardando dados da Ypoti" },
      { rotulo: "Dólar", valor: M.fx.brl, dec: 3, un: "R$", nota: M.fx.pyg ? "Gs " + F.n(M.fx.pyg, 0) + (M.cambio ? " · BCP" : "") : "" },
    ]);

    // ---- série do novillo
    const ini = b.inicioJanela, par = (D, V) => D.map((d, i) => [d, V[i]]).filter((p) => p[0] >= ini);
    const vendas = [...b.vendaMes.entries()].map(([k, v]) => [k + "-15", +v.toFixed(3)]).filter((p) => p[0] >= ini).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    const u2 = (v) => "US$ " + F.n(v, 2);
    desenhar("g-boi-serie", base({
      xAxis: eixoTempo(), yAxis: eixoY((v) => F.n(v, 1)),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : u2(v)) }),
      series: [linha("Paraguai (Valor Agro)", par(b.pyD, b.pyV), COR.py, rotuloFim((v) => F.n(v, 2), COR.py)),
        linha("Brasil (série âncora)", par(b.brD, b.brV), COR.br),
        vendas.length ? linha("Ypoti (venda do mês)", vendas, COR.ypoti, Object.assign({ showSymbol: true, symbolSize: rem() * 0.55, lineStyle: { width: 2, color: COR.ypoti } }, rotuloFim((v) => F.n(v, 2), COR.ypoti))) : null].filter(Boolean),
    }));

    // ---- basis sazonal do boi
    const pc = (v) => (v == null ? null : +(v * 100).toFixed(2));
    const anoTxt = String(C.anoDe(M.hoje));
    desenhar("g-boi-basis", base({
      xAxis: eixoX({ type: "category", data: MES, boundaryGap: false }), yAxis: eixoY((v) => F.n(v, 0) + "%"),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : F.n(v, 1) + "%") }),
      legend: Object.assign(base().legend, { data: ["Faixa P" + Math.round(M.S.qmin * 100) + "–P" + Math.round(M.S.qmax * 100), "Mediana", anoTxt] }),
      series: faixa("Faixa P" + Math.round(M.S.qmin * 100) + "–P" + Math.round(M.S.qmax * 100), b.saz.map((s) => pc(s.qmin)), b.saz.map((s) => pc(s.qmax))).concat([
        linha("Mediana", b.saz.map((s) => pc(s.med)), COR.t2, { lineStyle: { width: 1.5, color: COR.t2, type: "dashed" } }),
        linha(anoTxt, MES.map((_, i) => pc(b.basisAno.get(anoTxt + "-" + String(i + 1).padStart(2, "0")))), COR.py, Object.assign({ showSymbol: true, connectNulls: false }, rotuloFim((v) => F.n(v, 1) + "%", COR.py))),
      ]),
    }));

    // ---- curva do BGI
    const cv = b.curva.filter((c) => c.usd);
    desenhar("g-boi-curva", cv.length ? base({
      xAxis: eixoX({ type: "category", data: cv.map((c) => F.mesAno(c.venc)), boundaryGap: false }), yAxis: eixoY((v) => F.n(v, 2)),
      tooltip: Object.assign(base().tooltip, { formatter: (ps) => { const c = cv[ps[0].dataIndex];
        return "<b>" + c.cod + "</b> · " + F.dia(c.venc) + "<br>B3: R$ " + F.n(c.reais, 2) + "/@" + (c.liquido ? "" : " (ajuste)") + " · dólar " + F.n(c.fx, 3) +
          "<br>Brasil: US$ " + F.n(c.usd, 2) + "/kg<br>Paraguai pela mediana: US$ " + F.n(c.pyMed, 2) + "<br>Faixa do basis: US$ " + F.n(c.pyMin, 2) + " a " + F.n(c.pyMax, 2) +
          "<br><span style='opacity:.7'>basis do mês: " + F.pct(c.bMin, 1, true) + " · " + F.pct(c.bMed, 1, true) + " · " + F.pct(c.bMax, 1, true) + "</span>"; } }),
      legend: Object.assign(base().legend, { data: ["BGI em dólar", "Paraguai (mediana)", "Faixa do basis", "Valor Agro"].concat(b.vendaHoje != null ? ["Ypoti"] : []) }),
      series: faixa("Faixa do basis", cv.map((c) => +c.pyMin.toFixed(3)), cv.map((c) => +c.pyMax.toFixed(3))).concat([
        linha("BGI em dólar", cv.map((c) => +c.usd.toFixed(3)), COR.br, Object.assign({ showSymbol: true }, rotuloFim((v) => F.n(v, 2), COR.br))),
        linha("Paraguai (mediana)", cv.map((c) => +c.pyMed.toFixed(3)), COR.py, Object.assign({ showSymbol: true, lineStyle: { width: 2, color: COR.py, type: "dashed" } }, rotuloFim((v) => F.n(v, 2), COR.py))),
        linhaRef("Valor Agro", b.pyHoje, COR.py, (v) => "Valor Agro " + F.n(v, 2)),
      ]).concat(b.vendaHoje != null ? [linhaRef("Ypoti", +b.vendaHoje.toFixed(3), COR.ypoti, (v) => "Ypoti " + F.n(v, 2))] : []),
    }) : null, "Sem cotação da B3 neste momento.");

    // ---- milho: Paraguai interno × B3
    const iniM = m.inicioJanela, pm = (V) => m.d.map((d, i) => [d, V[i]]).filter((p) => p[0] >= iniM);
    const nossoM = [...m.milhoMes.entries()].map(([k, v]) => [k + "-15", +v.toFixed(1)]).filter((p) => p[0] >= iniM).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    const t0 = (v) => F.n(v, 0);
    desenhar("g-milho-serie", base({
      xAxis: eixoTempo({ max: M.hoje }), yAxis: eixoY(t0),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : "US$ " + F.n(v, 0) + "/t") }),
      series: [linha("Paraguai interno", pm(m.py), COR.py), linha("CCM B3 à vista", pm(m.b3), COR.br),
        fm && fm.usd ? { name: "CCM hoje", type: "scatter", data: [[M.hoje, +fm.usd.toFixed(1)]], symbolSize: rem() * 0.75, itemStyle: { color: COR.br, borderColor: "#06130C", borderWidth: 2 },
          label: { show: true, position: "left", formatter: (p) => F.n(p.value[1], 0), color: COR.tinta, fontSize: rem() * 0.82, fontWeight: 600 } } : null,
        nossoM.length ? linha("Ypoti (entregas do mês)", nossoM, COR.ypoti, Object.assign({ showSymbol: true }, rotuloFim(t0, COR.ypoti))) : null].filter(Boolean),
    }));

    // ---- basis sazonal do milho
    const r1 = (v) => (v == null ? null : +v.toFixed(1));
    const serieNosso = m.basisNosso != null ? [{ name: "Nosso basis hoje", type: "scatter", data: [[MES[+M.hoje.slice(5, 7) - 1], r1(m.basisNosso)]], symbolSize: rem() * 0.85, itemStyle: { color: COR.ypoti, borderColor: "#06130C", borderWidth: 2 },
      label: { show: true, position: "top", formatter: (p) => F.n(p.value[1], 0), color: COR.tinta, fontSize: rem() * 0.82, fontWeight: 600 } }] : [];
    desenhar("g-milho-basis", base({
      xAxis: eixoX({ type: "category", data: MES, boundaryGap: false }), yAxis: eixoY(t0),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : "US$ " + F.n(v, 0) + "/t") }),
      legend: Object.assign(base().legend, { data: ["Faixa P" + Math.round(M.S.qmin * 100) + "–P" + Math.round(M.S.qmax * 100), "Mediana", anoTxt].concat(serieNosso.length ? ["Nosso basis hoje"] : []) }),
      series: faixa("Faixa P" + Math.round(M.S.qmin * 100) + "–P" + Math.round(M.S.qmax * 100), m.saz.map((s) => r1(s.qmin)), m.saz.map((s) => r1(s.qmax))).concat([
        linha("Mediana", m.saz.map((s) => r1(s.med)), COR.t2, { lineStyle: { width: 1.5, color: COR.t2, type: "dashed" } }),
        linha(anoTxt, MES.map((_, i) => r1(m.basisAno.get(anoTxt + "-" + String(i + 1).padStart(2, "0")))), COR.py, Object.assign({ showSymbol: true, connectNulls: false }, rotuloFim(t0, COR.py))),
      ]).concat(serieNosso),
    }));

    // ---- curva do CCM
    const cm = m.curva.filter((c) => c.usd);
    desenhar("g-milho-curva", cm.length ? base({
      xAxis: eixoX({ type: "category", data: cm.map((c) => F.mesAno(c.venc)), boundaryGap: false }), yAxis: eixoY(t0),
      tooltip: Object.assign(base().tooltip, { formatter: (ps) => { const c = cm[ps[0].dataIndex];
        return "<b>" + c.cod + "</b> · " + F.dia(c.venc) + "<br>B3: R$ " + F.n(c.reais, 2) + "/saca" + (c.liquido ? "" : " (ajuste)") + " · dólar " + F.n(c.fx, 3) +
          "<br>Brasil: US$ " + F.n(c.usd, 0) + "/t<br>Paraguai pela mediana: US$ " + F.n(c.pyMed, 0) + "<br>Faixa do basis: US$ " + F.n(c.pyMin, 0) + " a " + F.n(c.pyMax, 0) +
          "<br><span style='opacity:.7'>basis do mês: " + F.n(c.bMin, 0) + " · " + F.n(c.bMed, 0) + " · " + F.n(c.bMax, 0) + " US$/t</span>"; } }),
      legend: Object.assign(base().legend, { data: ["CCM em dólar", "Paraguai (mediana)", "Faixa do basis"].concat(m.milhoHoje != null ? ["Ypoti"] : []) }),
      series: faixa("Faixa do basis", cm.map((c) => r1(c.pyMin)), cm.map((c) => r1(c.pyMax))).concat([
        linha("CCM em dólar", cm.map((c) => r1(c.usd)), COR.br, Object.assign({ showSymbol: true }, rotuloFim(t0, COR.br))),
        linha("Paraguai (mediana)", cm.map((c) => r1(c.pyMed)), COR.py, Object.assign({ showSymbol: true, lineStyle: { width: 2, color: COR.py, type: "dashed" } }, rotuloFim(t0, COR.py))),
      ]).concat(m.milhoHoje != null ? [linhaRef("Ypoti", r1(m.milhoHoje), COR.ypoti, (v) => "Ypoti " + F.n(v, 0))] : []),
    }) : null, "Sem cotação da B3 neste momento.");
  }

  // ================================================================== TELA 2 — reposição
  function telaReposicao(M) {
    const R = M.repo, u = R.u, a = R.ant, ag = R.agioHoje;
    const semDados = "A planilha de reposição não respondeu.";
    const var_ = (x, y) => (x != null && y ? x / y - 1 : null);
    kpis("kpis-reposicao", u ? [
      { rotulo: "Macho 180 kg", valor: u.m180, un: "Gs/kg", neutro: true, delta: a ? var_(u.m180, a.m180) : null, deltaTxt: a ? F.pct(Math.abs(var_(u.m180, a.m180)), 1) + " na semana" : "", nota: M.fx.pyg ? "· US$ " + F.n(u.m180 / M.fx.pyg, 2) : "" },
      { rotulo: "Macho 360 kg", valor: u.m360, un: "Gs/kg", neutro: true, delta: a ? var_(u.m360, a.m360) : null, deltaTxt: a ? F.pct(Math.abs(var_(u.m360, a.m360)), 1) + " na semana" : "", nota: M.fx.pyg ? "· US$ " + F.n(u.m360 / M.fx.pyg, 2) : "" },
      { rotulo: "β · quilo produzido", valor: u.beta, un: "Gs/kg", nota: M.fx.pyg ? "US$ " + F.n(u.beta / M.fx.pyg, 2) + " por kg vivo" : "" },
      { rotulo: "α · serviço da vaca (macho)", valor: u.aM / 1000, un: "mil Gs/cab", nota: "fêmea " + F.n(u.aF / 1000, 0) + " · peso do ágio aos 180 kg " + F.pct(u.aM / (u.aM + u.beta * 180), 0) },
      { rotulo: "Ágio do bezerro sobre o gordo", valor: ag ? ag.a180 : null, pct: true, dec: 0, sinal: true, nota: "180 kg, kg vivo · 360 kg " + F.pct(ag ? ag.a360 : null, 0, true) },
      { rotulo: "Nossas compras × mercado", valor: R.desvioRec != null ? Math.exp(R.desvioRec) - 1 : null, pct: true, dec: 1, sinal: true, destaque: true,
        nota: R.desvioRec != null ? F.n(R.cabRec, 0) + " cab em " + R.nRec + " compras · " + M.S.diasCompras + " dias" : "aguardando dados da Ypoti" },
    ] : [{ rotulo: "Reposição", valor: null, nota: semDados }]);

    const ini = R.inicioJanela, ind = R.ind.filter((r) => r.d >= ini);
    const gs = (v) => F.n(v / 1000, 1);
    desenhar("g-repo-pesos", ind.length ? base({
      xAxis: eixoTempo(), yAxis: eixoY(gs, { name: "mil Gs/kg", nameTextStyle: { color: COR.t3, fontSize: rem() * 0.72, align: "left" }, nameGap: rem() * 0.5 }),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : "Gs " + F.n(v, 0)) }),
      series: [["180 kg", "m180"], ["230 kg", "m230"], ["300 kg", "m300"], ["360 kg", "m360"]].map(([n, k], i) =>
        linha(n, ind.map((r) => [r.d, r[k]]), COR.rampa[i], Object.assign(rotuloFim((v) => F.n(v, 0), COR.rampa[i]), { labelLayout: { moveOverlap: "shiftY" } }))),
    }) : null, semDados);

    const agio = R.agio.filter((r) => r.d >= ini), nossas = R.compras.filter((c) => c.d >= ini && c.agio != null && c.sexo === "Macho");
    const nossasMes = [...C.porMes(nossas.map((c) => ({ d: c.d, v: c.agio, w: c.cab }))).entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([k, v]) => [k + "-15", +(v * 100).toFixed(1)]);
    desenhar("g-repo-agio", agio.length ? base({
      xAxis: eixoTempo(), yAxis: eixoY((v) => F.n(v, 0) + "%"),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : F.n(v, 0) + "%") }),
      series: [linha("Bezerro 180 kg", agio.map((r) => [r.d, r.a180 == null ? null : +(r.a180 * 100).toFixed(1)]), COR.rampa[0], rotuloFim((v) => F.n(v, 0) + "%", COR.rampa[0])),
        linha("Toretón 360 kg", agio.map((r) => [r.d, r.a360 == null ? null : +(r.a360 * 100).toFixed(1)]), COR.rampa[3], rotuloFim((v) => F.n(v, 0) + "%", COR.rampa[3])),
        nossasMes.length ? linha("Nossas compras (média do mês)", nossasMes, COR.ypoti, Object.assign({ showSymbol: true }, rotuloFim((v) => F.n(v, 0) + "%", COR.ypoti))) : null].filter(Boolean),
    }) : null, semDados);

    // ---- nossas compras × indicador, mês a mês
    const mm = [...R.desvioMes.keys()].sort().slice(-18);
    desenhar("g-repo-desvio", mm.length ? base({
      grid: { left: rem() * 0.4, right: rem() * 0.8, top: rem() * 2.6, bottom: rem() * 0.3, containLabel: true },
      legend: Object.assign(base().legend, { data: [{ name: "Abaixo do mercado", itemStyle: { color: COR.bom } }, { name: "Acima do mercado", itemStyle: { color: COR.ruim } }] }),
      xAxis: eixoX({ type: "category", data: mm.map((k) => F.mesAno(k + "-01")) }), yAxis: eixoY((v) => F.n(v, 0) + "%", { scale: false }),
      tooltip: Object.assign(base().tooltip, { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,.05)" } }, formatter: (ps) => { const k = mm[ps[0].dataIndex], v = Math.exp(R.desvioMes.get(k)) - 1;
        return "<b>" + F.mesAno(k + "-01") + "</b><br>" + F.pct(v, 1, true) + " contra o indicador<br>" + F.n(R.cabMes.get(k), 0) + " cabeças compradas"; } }),
      series: [{ name: "Abaixo do mercado", type: "bar", stack: "d", barMaxWidth: rem() * 1.6, itemStyle: { color: COR.bom, borderRadius: [0, 0, 4, 4] },
        data: mm.map((k) => { const v = (Math.exp(R.desvioMes.get(k)) - 1) * 100; return v < 0 ? +v.toFixed(1) : null; }), label: { show: true, position: "bottom", color: COR.tinta, fontSize: rem() * 0.72, formatter: (p) => F.n(p.value, 0) } },
      { name: "Acima do mercado", type: "bar", stack: "d", barMaxWidth: rem() * 1.6, itemStyle: { color: COR.ruim, borderRadius: [4, 4, 0, 0] },
        data: mm.map((k) => { const v = (Math.exp(R.desvioMes.get(k)) - 1) * 100; return v >= 0 ? +v.toFixed(1) : null; }), label: { show: true, position: "top", color: COR.tinta, fontSize: rem() * 0.72, formatter: (p) => "+" + F.n(p.value, 0) } }],
    }) : null, "Aguardando as compras da Ypoti (ponte de dados não conectada).");

    // ---- nuvem α + β·w (valor por cabeça) e hipérbole do ágio (preço por kg)
    if (u) {
      const mk = (sexo) => R.nuvem.filter((l) => l.sexo === sexo), W = [80, 110, 140, 170, 200, 230, 260, 290, 320, 350, 380, 410, 440];
      const nos = R.comprasRec.filter((c) => c.sexo === "Macho");
      const tam = (cab) => Math.max(rem() * 0.6, Math.min(rem() * 1.5, Math.sqrt(cab || 30) * rem() * 0.07));
      const pontos = (arr, ix, fy, cor, op, nome) => ({ name: nome, type: "scatter", xAxisIndex: ix, yAxisIndex: ix, data: arr.map((l) => [l.peso, fy(l), l.d, l.cab, l.fonte || "Ypoti", l.pkg]), symbolSize: rem() * 0.42,
        itemStyle: { color: cor, opacity: op }, emphasis: { scale: 1.6 } });
      const nosso = (ix, fy) => ({ name: "Nossas compras", type: "scatter", xAxisIndex: ix, yAxisIndex: ix, z: 5, data: nos.map((c) => [c.peso, fy(c), c.d, c.cab, c.destino, c.pkg, c.desvio]), symbolSize: (v) => tam(v[3]),
        itemStyle: { color: COR.ypoti, opacity: 0.92, borderColor: "#06130C", borderWidth: 2 } });
      const reta = (nome, ix, f, cor) => ({ name: nome, type: "line", xAxisIndex: ix, yAxisIndex: ix, data: W.map((w) => [w, f(w)]), showSymbol: false, smooth: ix === 1, lineStyle: { width: 2.5, color: cor }, itemStyle: { color: cor }, z: 4, tooltip: { show: false } });
      const r = rem(), tip = (p) => { const v = p.value; return "<b>" + p.seriesName + "</b> · " + F.dia(v[2]) + "<br>" + (v[3] ? F.n(v[3], 0) + " cab · " : "") + F.n(v[0], 0) + " kg<br>Gs " + F.n(v[5], 0) + "/kg · Gs " + F.n(v[5] * v[0], 0) + "/cab" +
        (v[4] ? "<br><span style='opacity:.7'>" + v[4] + "</span>" : "") + (v[6] != null ? "<br>" + F.pct(Math.exp(v[6]) - 1, 1, true) + " contra o indicador" : ""); };
      desenhar("g-repo-nuvem", base({
        tooltip: Object.assign(base().tooltip, { trigger: "item", formatter: tip }),
        legend: Object.assign(base().legend, { data: ["Leilões · macho", "Leilões · fêmea", "α + β·w macho", "α + β·w fêmea"].concat(nos.length ? ["Nossas compras"] : []) }),
        grid: [{ left: r * 0.4, right: "52%", top: r * 3.4, bottom: r * 1.6, containLabel: true }, { left: "52%", right: r * 1.2, top: r * 3.4, bottom: r * 1.6, containLabel: true }],
        title: [{ text: "Valor por cabeça = α + β · peso   (milhões de Gs)", left: r * 0.4, top: r * 1.7, textStyle: { color: COR.t3, fontSize: r * 0.76, fontWeight: 400 } },
          { text: "Preço por quilo = β + α ÷ peso   (mil Gs/kg) · assíntota em β", left: "52%", top: r * 1.7, textStyle: { color: COR.t3, fontSize: r * 0.76, fontWeight: 400 } }],
        xAxis: [0, 1].map((i) => eixoX({ type: "value", gridIndex: i, min: 60, max: 460, name: "peso vivo (kg)", nameLocation: "middle", nameGap: r * 1.5, nameTextStyle: { color: COR.t3, fontSize: r * 0.74 } })),
        yAxis: [eixoY((v) => F.n(v, 1), { gridIndex: 0, scale: false }), eixoY((v) => F.n(v, 0), { gridIndex: 1 })],
        series: [pontos(mk("Fêmea"), 0, (l) => l.pkg * l.peso / 1e6, COR.magenta, 0.4, "Leilões · fêmea"), pontos(mk("Macho"), 0, (l) => l.pkg * l.peso / 1e6, COR.py, 0.55, "Leilões · macho"),
          reta("α + β·w fêmea", 0, (w) => (u.aF + u.beta * w) / 1e6, COR.magenta), reta("α + β·w macho", 0, (w) => (u.aM + u.beta * w) / 1e6, COR.py),
          pontos(mk("Fêmea"), 1, (l) => l.pkg / 1000, COR.magenta, 0.4, "Leilões · fêmea"), pontos(mk("Macho"), 1, (l) => l.pkg / 1000, COR.py, 0.55, "Leilões · macho"),
          reta("α + β·w fêmea", 1, (w) => (u.beta + u.aF / w) / 1000, COR.magenta),
          Object.assign(reta("α + β·w macho", 1, (w) => (u.beta + u.aM / w) / 1000, COR.py), { markLine: { silent: true, symbol: "none", data: [{ yAxis: u.beta / 1000 }], lineStyle: { color: COR.t2, type: "dashed", width: 1.2 },
            label: { formatter: "β = " + F.n(u.beta, 0), color: COR.tinta, fontSize: r * 0.76, position: "insideStartTop" } } }),
        ].concat(nos.length ? [nosso(0, (c) => c.pcab / 1e6), nosso(1, (c) => c.pkg / 1000)] : []),
      }));

      // ---- séries de β e de α (duas grades, uma unidade cada)
      const dados = (k, div) => ind.map((x) => [x.d, x[k] == null ? null : +(x[k] / div).toFixed(2)]);
      desenhar("g-repo-ab", base({
        legend: Object.assign(base().legend, { data: ["β", "α macho", "α fêmea"] }),
        tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : F.n(v, 1)) }),
        axisPointer: { link: [{ xAxisIndex: "all" }] },
        grid: [{ left: r * 0.4, right: r * 3.6, top: r * 3.4, height: "30%", containLabel: true }, { left: r * 0.4, right: r * 3.6, top: "64%", bottom: r * 0.3, containLabel: true }],
        title: [{ text: "β · quilo produzido (mil Gs/kg)", left: r * 0.4, top: r * 1.7, textStyle: { color: COR.t3, fontSize: r * 0.76, fontWeight: 400 } },
          { text: "α · serviço da vaca (milhões de Gs/cab)", left: r * 0.4, top: "55%", textStyle: { color: COR.t3, fontSize: r * 0.76, fontWeight: 400 } }],
        xAxis: [eixoTempo({ gridIndex: 0, axisLabel: { show: false } }), eixoTempo({ gridIndex: 1 })],
        yAxis: [eixoY((v) => F.n(v, 0), { gridIndex: 0, splitNumber: 3 }), eixoY((v) => F.n(v, 1), { gridIndex: 1, splitNumber: 3 })],
        series: [linha("β", dados("beta", 1000), COR.amarelo, Object.assign({ xAxisIndex: 0, yAxisIndex: 0 }, rotuloFim((v) => F.n(v, 1), COR.amarelo))),
          linha("α macho", dados("aM", 1e6), COR.py, Object.assign({ xAxisIndex: 1, yAxisIndex: 1 }, rotuloFim((v) => F.n(v, 2), COR.py))),
          linha("α fêmea", dados("aF", 1e6), COR.magenta, Object.assign({ xAxisIndex: 1, yAxisIndex: 1 }, rotuloFim((v) => F.n(v, 2), COR.magenta)))],
      }));
    } else { desenhar("g-repo-nuvem", null, semDados); desenhar("g-repo-ab", null, semDados); }
  }

  // ================================================================== TELA 3 — lucratividade
  function telaLucro(M) {
    const L = M.lucro, A = L.atual, G = A.global, p = L.pHoje, r = rem();
    const u0 = (v) => F.n(v, 0);
    kpis("kpis-lucro", [
      { rotulo: "Lucro do ciclo completo", valor: G.lucro, dec: 0, un: "US$/cab", destaque: true, nota: "bezerro de 180 kg até o abate · " + F.n(G.ciclo, 0) + " dias" },
      { rotulo: "TIR do ciclo", valor: G.tir, pct: true, dec: 1, nota: "ao ano · juros da conta " + F.pct(p.juros, 1) },
      { rotulo: "Recria a pasto", valor: A.recria.lucro, dec: 0, un: "US$/cab", nota: "TIR " + F.pct(A.recria.tir, 0) + " · " + F.n(A.recria.dias, 0) + " dias" },
      { rotulo: "RIP", valor: A.rip.lucro, dec: 0, un: "US$/cab", nota: "TIR " + F.pct(A.rip.tir, 0) + " · " + F.n(A.rip.dias, 0) + " dias" },
      { rotulo: "Confinamento", valor: A.conf.lucro, dec: 0, un: "US$/cab", nota: "TIR " + F.pct(A.conf.tir, 0) + " · " + F.n(A.conf.dias, 0) + " dias" },
      { rotulo: "Ponto de equilíbrio do gordo", valor: G.pontoEquilibrio, dec: 2, un: "US$/kg carcaça", nota: "nosso preço " + F.n(p.venda, 2) + " · folga " + F.n(p.venda - G.pontoEquilibrio, 2) },
    ]);

    const S = L.serie, x = S.map((s) => s.mes + "-15");
    desenhar("g-lucro-serie", S.length > 1 ? base({
      xAxis: eixoTempo(), yAxis: eixoY(u0, { scale: false }),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : "US$ " + F.n(v, 0) + "/cab") }),
      series: [linha("Ciclo completo", S.map((s, i) => [x[i], +s.r.global.lucro.toFixed(1)]), COR.tinta, Object.assign({ lineStyle: { width: 3, color: COR.tinta }, z: 5 }, rotuloFim(u0, COR.tinta))),
        linha("Recria a pasto", S.map((s, i) => [x[i], +s.r.recria.lucro.toFixed(1)]), COR.br, rotuloFim(u0, COR.br)),
        linha("RIP", S.map((s, i) => [x[i], +s.r.rip.lucro.toFixed(1)]), COR.amarelo, rotuloFim(u0, COR.amarelo)),
        linha("Confinamento", S.map((s, i) => [x[i], +s.r.conf.lucro.toFixed(1)]), COR.violeta, Object.assign(rotuloFim(u0, COR.violeta), { markLine: { silent: true, symbol: "none", data: [{ yAxis: 0 }], lineStyle: { color: COR.eixo, width: 1 }, label: { show: false } } }))],
    }) : null, "A série de reposição não respondeu.");

    desenhar("g-lucro-equilibrio", S.length > 1 ? base({
      xAxis: eixoTempo(), yAxis: eixoY((v) => F.n(v, 1)),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : "US$ " + F.n(v, 2) + "/kg") }),
      series: [linha(L.temVenda ? "Nosso preço de venda" : "Preço usado (Valor Agro)", S.map((s, i) => [x[i], +s.r.entrada.venda.toFixed(3)]), COR.ypoti, rotuloFim((v) => F.n(v, 2), COR.ypoti)),
        linha("Ponto de equilíbrio do ciclo", S.map((s, i) => [x[i], +s.r.global.pontoEquilibrio.toFixed(3)]), COR.magenta, rotuloFim((v) => F.n(v, 2), COR.magenta))]
        .concat(L.temVenda ? [linha("Mercado (Valor Agro)", S.map((s, i) => [x[i], s.mercado == null ? null : +s.mercado.toFixed(3)]), COR.py, { lineStyle: { width: 1.5, color: COR.py, type: "dashed" } })] : []),
    }) : null, "A série de reposição não respondeu.");

    // ---- sensibilidade (lucro do ciclo × preço do gordo × preço do bezerro)
    const z = L.sens.z, flat = [].concat.apply([], z), lim = Math.max.apply(null, flat.map(Math.abs)) || 1;
    desenhar("g-lucro-sens", base({
      grid: { left: r * 0.4, right: r * 0.6, top: r * 1.9, bottom: r * 1.8, containLabel: true }, legend: { show: false },
      tooltip: Object.assign(base().tooltip, { trigger: "item", formatter: (q) => "Gordo a US$ " + F.n(p.venda + L.sens.dv[q.value[0]], 2) + "/kg<br>Bezerro a Gs " + F.n(p.desmamante * (1 + L.sens.db[q.value[1]]), 0) + "/kg<br><b>US$ " + F.n(q.value[2], 0) + "/cab</b>" }),
      xAxis: eixoX({ type: "category", data: L.sens.dv.map((d) => F.n(p.venda + d, 2)), name: "preço do gordo (US$/kg carcaça)", nameLocation: "middle", nameGap: r * 1.7, nameTextStyle: { color: COR.t3, fontSize: r * 0.74 }, splitArea: { show: false } }),
      yAxis: { type: "category", data: L.sens.db.map((d) => F.n(p.desmamante * (1 + d) / 1000, 1)), name: "bezerro 180 kg (mil Gs/kg)", nameTextStyle: { color: COR.t3, fontSize: r * 0.74, align: "left" }, nameGap: r * 0.5,
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: COR.t3, fontSize: r * 0.76 } },
      visualMap: { show: false, min: -lim, max: lim, dimension: 2, inRange: { color: ["#b23233", "#5a3030", "#2c3330", "#1f5a2a", "#0c8f22"] } },
      series: [{ type: "heatmap", data: [].concat.apply([], z.map((lin, j) => lin.map((v, i) => (i === 3 && j === 3 ? { value: [i, j, +v.toFixed(0)], itemStyle: { borderColor: COR.tinta, borderWidth: 3 } } : [i, j, +v.toFixed(0)])))), itemStyle: { borderColor: "rgba(6,19,12,.9)", borderWidth: 2, borderRadius: 5 },
        label: { show: true, color: COR.tinta, fontSize: r * 0.8, fontWeight: 600, formatter: (q) => F.n(q.value[2], 0) }, emphasis: { itemStyle: { borderColor: COR.tinta } } }],
    }));

    // ---- a conta de hoje (como na planilha)
    const R = A.recria, I = A.rip, K = A.conf, d0 = (v) => F.n(v, 0), d2 = (v) => F.n(v, 2);
    const lin = (rot, a, b, c, g, cls) => "<tr" + (cls ? ' class="' + cls + '"' : "") + "><th>" + rot + "</th><td>" + a + "</td><td>" + b + "</td><td>" + c + "</td><td>" + g + "</td></tr>";
    const comp = (nome, hoje, plan, dec, un) => "<tr><th>" + nome + "</th><td>" + F.n(hoje, dec) + (un || "") + "</td><td class='apagado'>" + F.n(plan, dec) + (un || "") + "</td></tr>";
    const b = L.base;
    document.getElementById("conta-lucro").innerHTML =
      '<table class="conta"><thead><tr><th></th><th>Recria</th><th>RIP</th><th>Confin.</th><th>Ciclo</th></tr></thead><tbody>' +
      lin("Peso de entrada → saída (kg)", d0(R.pesoIni) + " → " + d0(R.pesoFim), d0(I.pesoIni) + " → " + d0(I.pesoFim), d0(K.pesoIni) + " → " + d0(K.pesoFim), d0(R.pesoIni) + " → " + d0(K.pesoFim)) +
      lin("Dias", d0(R.dias), d0(I.dias), d0(K.dias), d0(G.ciclo)) +
      lin("Receita líquida", d0(R.receita), d0(I.receita), d0(K.receita), d0(K.receita), "sep") +
      lin("Compra do animal", d0(R.compra), d0(I.compra), d0(K.compra), d0(R.compra)) +
      lin("Produção / nutrição", d0(R.producao), d0(I.producao), d0(K.nutricional), d0(R.producao + I.producao + K.nutricional)) +
      lin("Operacional", "–", "–", d0(K.operacional), d0(K.operacional)) +
      lin("Financeiro", d0(R.financeiro), d0(I.financeiro), d0(K.financeiro), d0(R.financeiro + I.financeiro + K.financeiro)) +
      lin("Outros", d0(R.outros), d0(I.outros), d0(K.outros), d0(R.outros + I.outros + K.outros)) +
      lin("Lucro (US$/cab)", d0(R.lucro), d0(I.lucro), d0(K.lucro), d0(G.lucro), "total") +
      lin("Lucro anualizado", d0(R.lucroAno), d0(I.lucroAno), d0(K.lucroAno), d0(G.lucroAno)) +
      lin("TIR ao ano", F.pct(R.tir, 0), F.pct(I.tir, 0), F.pct(K.tir, 0), F.pct(G.tir, 1)) +
      "</tbody></table>" +
      '<table class="conta premissas"><thead><tr><th>O que entrou na conta</th><th>Hoje</th><th>Planilha</th></tr></thead><tbody>' +
      comp("Bezerro 180 kg (Gs/kg)", p.desmamante, b.desmamante, 0) + comp("Toretón 360 kg (Gs/kg)", p.toreton, b.toreton, 0) +
      comp("Gordo, nosso preço (US$/kg)", p.venda, b.venda, 2) + comp("Câmbio (Gs/US$)", p.cambio, b.cambio, 0) +
      comp("GMD no confinamento (kg)", p.conf.gmd, b.conf.gmd, 2) + comp("Rendimento final", p.conf.rcFin * 100, b.conf.rcFin * 100, 1, "%") +
      comp("Consumo (kg MS/dia)", p.conf.consumo, b.conf.consumo, 1) + comp("Custo nutricional (US$/kg MS)", p.conf.custoNutr, b.conf.custoNutr, 3) +
      comp("Gastos operacionais (US$/cab-dia)", p.conf.gastosOp, b.conf.gastosOp, 2) + comp("Custo do kg de carcaça produzido (US$)", K.custoKgProd, L.padrao.conf.custoKgProd, 2) +
      "</tbody></table>" +
      '<table class="conta premissas"><thead><tr><th>Fluxo de caixa do ciclo</th><th>Dia</th><th>US$/cab</th></tr></thead><tbody>' +
      G.fluxos.map((f) => "<tr><th>" + f.evento + "</th><td>" + F.n(f.dia, 0) + "</td><td>" + (f.valor > 0 ? "+" : "") + F.n(f.valor, 0) + "</td></tr>").join("") +
      "<tr class='total'><th>Lucro · TIR " + F.pct(G.tir, 1) + " ao ano</th><td>" + F.n(G.ciclo, 0) + "</td><td>" + F.n(G.lucro, 0) + "</td></tr></tbody></table>" +
      '<p class="nota-conta">' + (L.indHoje ? "Indicadores do confinamento: média ponderada dos lotes abatidos em " + L.fechados.map((m) => F.mesAno(m + "-01")).join(", ") + " (meses fechados)." :
        "Indicadores do confinamento: valores fixos da planilha" + (M.S.indicadores === "realizado" ? " (os resultados do confinamento ainda não chegaram)." : ".")) +
      " Preço do gordo: " + L.vendaRef + ". Meses sem abate na série são interpolados.</p>";
  }

  // ================================================================== TELA 4 — câmbio (BCP) e análise técnica
  function telaCambio(M) {
    const X = M.cambio, r = rem(), semDados = "Aguardando o câmbio do BCP (ponte de dados não conectada).";
    const ids = ["g-cambio-hist", "g-cambio-hoje", "g-cambio-spread", "g-cambio-ifr"];
    if (!X) {
      kpis("kpis-cambio", [{ rotulo: "Dólar BCP", valor: null, nota: "aguardando dados" }]);
      ids.forEach((id) => desenhar(id, null, semDados)); document.getElementById("tecnica-cambio").innerHTML = '<p class="vazio">' + semDados + "</p>"; return;
    }
    const u = X.ult, n = X.dias.length, g0 = (v) => F.n(v, 0), g2 = (v) => F.n(v, 2), dm = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
    const ifrHoje = X.ifr[n - 1], viva = X.aberto ? '<i class="luz-viva"></i>' : "";
    kpis("kpis-cambio", [
      { rotulo: viva + "Compra · BCP", valor: u.compra, dec: 2, un: "Gs/US$", destaque: true, nota: u.h + " · " + dm(X.hoje.d) + (X.aberto ? " · mercado aberto" : " · fechado") },
      { rotulo: viva + "Venda · BCP", valor: u.venda, dec: 2, un: "Gs/US$", destaque: true, nota: "média do dia " + g2(X.ref) },
      { rotulo: "Spread compra–venda", valor: u.spread, dec: 0, un: "bps", nota: "mediana de 30 dias: " + F.n(X.spread30, 0) + " bps" },
      { rotulo: "Dólar no dia", valor: X.varDia, pct: true, dec: 2, sinal: true, neutro: true, delta: X.varDia, deltaTxt: X.ontem ? "contra " + g2(X.ontem.c) + " de ontem" : "", nota: "" },
      { rotulo: "Tendência · médias 10/50", texto: X.sinal ? (X.sinal === "alta" ? "Dólar em alta" : "Dólar em baixa") : "–", nota: X.desde ? "desde " + dm(X.desde) + " · 60 dias " + F.pct(X.mom60, 1, true) : "faltam dias para a média de 50" },
      { rotulo: "Força relativa · IFR 14", valor: ifrHoje, dec: 0, nota: ifrHoje == null ? "" : ifrHoje >= 70 ? "sobrecomprado (acima de 70)" : ifrHoje <= 30 ? "sobrevendido (abaixo de 30)" : "zona neutra (entre 30 e 70)" },
      { rotulo: "Horário de menor spread", texto: X.melhor ? X.melhor.h : "–", nota: X.melhor ? "mediana de " + F.n(X.melhor.med, 0) + " bps em 60 pregões" : "" },
    ]);

    // ---- histórico em velas, médias, picos e vales
    const datas = X.dias.map((x) => dm(x.d)), conf = X.pv;
    const marca = (tipo) => conf.filter((p) => p.tipo === tipo).map((p) => ({ value: [p.i, +p.v.toFixed(1)], confirmado: p.confirmado }));
    desenhar("g-cambio-hist", base({
      grid: { left: r * 0.4, right: r * 4.2, top: r * 2.6, bottom: r * 0.3, containLabel: true },
      legend: Object.assign(base().legend, { data: ["Dólar (vela do dia)", "Média de 10 dias", "Média de 50 dias", "Picos", "Vales"] }),
      xAxis: eixoX({ type: "category", data: datas, boundaryGap: true, axisLabel: { color: COR.t3, fontSize: r * 0.76, hideOverlap: true, interval: Math.max(0, Math.floor(n / 12) - 1) } }),
      yAxis: eixoY(g0, { min: (v) => Math.floor((v.min - (v.max - v.min) * 0.09) / 50) * 50, max: (v) => Math.ceil((v.max + (v.max - v.min) * 0.09) / 50) * 50 }),
      tooltip: Object.assign(base().tooltip, { formatter: (ps) => { const i = ps[0].dataIndex, x = X.dias[i];
        return "<b>" + F.dia(x.d) + "</b><br>abertura " + g2(x.o) + " · máxima " + g2(x.h) + "<br>mínima " + g2(x.l) + " · fechamento " + g2(x.c) + "<br>compra " + g2(x.compra) + " · venda " + g2(x.venda) +
          (X.m10[i] != null ? "<br>média 10: " + g2(X.m10[i]) : "") + (X.m50[i] != null ? " · média 50: " + g2(X.m50[i]) : "") + (X.ifr[i] != null ? "<br>IFR 14: " + F.n(X.ifr[i], 0) : ""); } }),
      series: [
        { name: "Dólar (vela do dia)", type: "candlestick", data: X.dias.map((x) => [+x.o.toFixed(1), +x.c.toFixed(1), +x.l.toFixed(1), +x.h.toFixed(1)]), barMaxWidth: r * 0.55,
          itemStyle: { color: COR.bom, color0: COR.ruim, borderColor: COR.bom, borderColor0: COR.ruim },
          markLine: { silent: true, symbol: "none", data: [X.resistencia ? { yAxis: +X.resistencia.toFixed(1), name: "Resistência" } : null, X.suporte ? { yAxis: +X.suporte.toFixed(1), name: "Suporte" } : null].filter(Boolean),
            lineStyle: { color: COR.t2, type: "dashed", width: 1.2 }, label: { formatter: (q) => q.name + " " + F.n(q.value, 0), color: COR.tinta, fontSize: r * 0.76, position: "insideStartTop", backgroundColor: "rgba(6,19,12,.55)", padding: [2, 4], borderRadius: 4 } } },
        linha("Média de 10 dias", X.m10.map((v) => (v == null ? null : +v.toFixed(1))), COR.amarelo, Object.assign({ connectNulls: false }, rotuloFim(g0, COR.amarelo))),
        linha("Média de 50 dias", X.m50.map((v) => (v == null ? null : +v.toFixed(1))), COR.violeta, Object.assign({ connectNulls: false }, rotuloFim(g0, COR.violeta))),
        { name: "_zz", type: "line", data: conf.map((p) => [p.i, +p.v.toFixed(1)]), symbol: "none", lineStyle: { color: COR.t3, width: 1, type: "dotted" }, silent: true, tooltip: { show: false }, z: 1 },
        { name: "Picos", type: "scatter", data: marca("pico"), symbol: "triangle", symbolRotate: 180, symbolSize: r * 0.8, symbolOffset: [0, -r * 0.75], itemStyle: { color: COR.magenta, borderColor: "#06130C", borderWidth: 1 }, z: 6, tooltip: { show: false },
          label: { show: true, position: "top", distance: r * 0.9, formatter: (q) => F.n(q.value[1], 0), color: COR.tinta, fontSize: r * 0.74, fontWeight: 600 }, labelLayout: { hideOverlap: true } },
        { name: "Vales", type: "scatter", data: marca("vale"), symbol: "triangle", symbolSize: r * 0.8, symbolOffset: [0, r * 0.75], itemStyle: { color: COR.py, borderColor: "#06130C", borderWidth: 1 }, z: 6, tooltip: { show: false },
          label: { show: true, position: "bottom", distance: r * 0.9, formatter: (q) => F.n(q.value[1], 0), color: COR.tinta, fontSize: r * 0.74, fontWeight: 600 }, labelLayout: { hideOverlap: true } },
      ],
    }));

    // ---- o dia, corte a corte
    const cortes = ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00"];
    const noCorte = (dia, campo) => cortes.map((h) => { const c = dia && dia.cortes.find((x) => x.h === h && !x.semNeg); return c ? +c[campo].toFixed(2) : null; });
    desenhar("g-cambio-hoje", base({
      xAxis: eixoX({ type: "category", data: cortes, boundaryGap: false }), yAxis: eixoY(g0),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : "Gs " + g2(v)) }),
      legend: Object.assign(base().legend, { data: ["Compra", "Venda", "Médio de ontem"] }),
      series: [linha("Compra", noCorte(X.hoje, "compra"), COR.py, Object.assign({ showSymbol: true, connectNulls: false }, rotuloFim(g0, COR.py))),
        linha("Venda", noCorte(X.hoje, "venda"), COR.magenta, Object.assign({ showSymbol: true, connectNulls: false }, rotuloFim(g0, COR.magenta))),
        linha("Médio de ontem", noCorte(X.ontem, "medio"), COR.t2, { lineStyle: { width: 1.5, color: COR.t2, type: "dashed" }, connectNulls: false })],
    }));

    // ---- diferença entre compra e venda por horário
    desenhar("g-cambio-spread", X.spreadHora.length ? base({
      grid: { left: r * 0.4, right: r * 0.8, top: r * 0.8, bottom: r * 0.3, containLabel: true }, legend: { show: false },
      xAxis: eixoX({ type: "category", data: X.spreadHora.map((x) => x.h) }), yAxis: eixoY(g0, { scale: false }),
      tooltip: Object.assign(base().tooltip, { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,.05)" } }, formatter: (ps) => { const x = X.spreadHora[ps[0].dataIndex];
        return "<b>" + x.h + "</b><br>diferença mediana: " + F.n(x.med, 0) + " bps<br>" + F.n(x.n, 0) + " cortes com negócio nos últimos 60 pregões"; } }),
      series: [{ type: "bar", name: "Diferença mediana", barMaxWidth: r * 2.2, itemStyle: { color: COR.py, borderRadius: [4, 4, 0, 0] }, data: X.spreadHora.map((x) => +x.med.toFixed(1)),
        label: { show: true, position: "top", color: COR.tinta, fontSize: r * 0.76, fontWeight: 600, formatter: (q) => F.n(q.value, 0) } }],
    }) : null, semDados);

    // ---- força relativa
    desenhar("g-cambio-ifr", base({
      grid: { left: r * 0.4, right: r * 3.2, top: r * 0.8, bottom: r * 0.3, containLabel: true }, legend: { show: false },
      xAxis: eixoX({ type: "category", data: datas, boundaryGap: false, axisLabel: { color: COR.t3, fontSize: r * 0.76, hideOverlap: true, interval: Math.max(0, Math.floor(n / 6) - 1) } }),
      yAxis: eixoY(g0, { scale: false, min: 0, max: 100, interval: 10, axisLabel: { color: COR.t3, fontSize: r * 0.76, formatter: (v) => (v === 30 || v === 50 || v === 70 || v === 0 || v === 100 ? v : "") }, splitLine: { show: false } }),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : F.n(v, 0)) }),
      series: [linha("IFR 14", X.ifr.map((v) => (v == null ? null : +v.toFixed(1))), COR.br, Object.assign({ connectNulls: false,
        markLine: { silent: true, symbol: "none", data: [{ yAxis: 70 }, { yAxis: 30 }], lineStyle: { color: COR.t3, type: "dashed", width: 1 }, label: { show: false } },
        markArea: { silent: true, itemStyle: { color: "rgba(234,242,236,.06)" }, data: [[{ yAxis: 30 }, { yAxis: 70 }]] } }, rotuloFim(g0, COR.br)))],
    }));

    // ---- leitura técnica e últimos picos e vales
    const ult8 = X.pv.slice(-5), dist = (nivel) => (nivel ? F.pct(nivel / u.medio - 1, 1, true) : "–");
    const linhasPv = ult8.map((p, k) => { const ant = k > 0 ? ult8[k - 1] : X.pv[X.pv.length - ult8.length - 1];
      return "<tr><th>" + (p.tipo === "pico" ? '<i class="tri pico"></i>Pico' : '<i class="tri vale"></i>Vale') + (p.confirmado ? "" : " <span class='apagado'>(em formação)</span>") + "</th><td>" + dm(X.dias[p.i].d) + "</td><td>" + g0(p.v) +
        "</td><td>" + (ant ? F.pct(p.v / ant.v - 1, 1, true) : "–") + "</td><td>" + (ant ? p.i - ant.i : "–") + "</td></tr>"; }).reverse().join("");
    document.getElementById("tecnica-cambio").innerHTML =
      '<table class="conta"><thead><tr><th>Leitura de hoje</th><th></th></tr></thead><tbody>' +
      "<tr><th>Tendência pelas médias de 10 e 50 dias</th><td>" + (X.sinal ? (X.sinal === "alta" ? "dólar em alta" : "dólar em baixa") + (X.desde ? " desde " + dm(X.desde) : "") : "–") + "</td></tr>" +
      "<tr><th>Média de 10 · média de 50</th><td>" + g0(X.m10[n - 1]) + " · " + g0(X.m50[n - 1]) + "</td></tr>" +
      "<tr><th>Variação em 20 e em 60 pregões</th><td>" + F.pct(X.mom20, 1, true) + " · " + F.pct(X.mom60, 1, true) + "</td></tr>" +
      "<tr><th>Resistência (último pico confirmado)</th><td>" + g0(X.resistencia) + " <span class='apagado'>" + dist(X.resistencia) + "</span></td></tr>" +
      "<tr><th>Suporte (último vale confirmado)</th><td>" + g0(X.suporte) + " <span class='apagado'>" + dist(X.suporte) + "</span></td></tr>" +
      "<tr><th>Máxima e mínima desde " + dm(X.dias[0].d) + "</th><td>" + g0(X.max) + " · " + g0(X.min) + "</td></tr>" +
      "</tbody></table>" +
      '<table class="conta premissas"><thead><tr><th>Picos e vales</th><th>Data</th><th>Gs/US$</th><th>Variação</th><th>Pregões</th></tr></thead><tbody>' + linhasPv + "</tbody></table>" +
      '<p class="nota-conta">Velas, médias e IFR sobre o preço médio entre compra e venda de cada corte do BCP (mercado flutuante com clientes não financeiros), desde ' + F.dia(X.dias[0].d) +
      ". Pico ou vale confirmado após reversão de " + F.pct(M.S.limiarPivo || 0.02, 1) + ". No estudo do câmbio, valor mesmo tiveram a tendência (médias) e o horário da conversão; osciladores como o IFR não funcionaram neste par.</p>";
  }

  /** Pílula do topo: câmbio ao vivo, em todas as telas. */
  function pilulaCambio(M) {
    const el = document.getElementById("pilula-cambio"); if (!el) return;
    const X = M.cambio;
    if (!X) { el.hidden = !M.fx.pyg; el.innerHTML = M.fx.pyg ? "<span>US$</span><b>" + F.n(M.fx.pyg, 0) + "</b>" : ""; el.classList.remove("vivo"); return; }
    el.hidden = false; el.classList.toggle("vivo", X.aberto);
    el.innerHTML = '<i class="luz-viva"></i><span>Gs/US$</span><b>' + F.n(X.ult.compra, 0) + '</b><span class="sep">·</span><b>' + F.n(X.ult.venda, 0) + "</b><span>" + X.ult.h + "</span>";
    el.title = "Câmbio BCP: compra · venda no corte das " + X.ult.h;
  }
  /** Pisca os números do câmbio quando chega um corte novo. */
  function piscar(subiu) {
    document.querySelectorAll("#pilula-cambio, #kpis-cambio .kpi.destaque").forEach((el) => { el.classList.remove("piscou-alta", "piscou-baixa"); void el.offsetWidth; el.classList.add(subiu ? "piscou-alta" : "piscou-baixa"); });
  }

  window.Telas = { F, COR, telaGordo, telaReposicao, telaLucro, telaCambio, pilulaCambio, piscar, reanimar, redimensionar, contar };
})();

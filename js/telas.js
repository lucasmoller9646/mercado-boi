/* Mercado do Boi — desenho das quatro telas (indicadores, gráficos ECharts e tabelas). */
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
  // meses e dias em português nos eixos de tempo
  echarts.registerLocale("PT", { time: { month: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
    monthAbbr: MES.map((m) => m[0].toUpperCase() + m.slice(1)), dayOfWeek: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"], dayOfWeekAbbr: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] } });
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
    if (!graficos[id]) graficos[id] = echarts.init(el, null, { renderer: "canvas", locale: "PT" });
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
  const cliques = {};
  /** Liga (uma vez) um clique nos pontos do gráfico; o tratador mais novo vale. */
  function ligarClique(id, f) { cliques[id] = f; const g = graficos[id]; if (g && !g.__clique) { g.__clique = true; g.on("click", (p) => cliques[id] && cliques[id](p)); } }
  /** Liga (uma vez) um clique em qualquer ponto da área do gráfico; devolve o valor do eixo x. */
  function ligarFundo(id, f) { cliques["fundo:" + id] = f; const g = graficos[id]; if (g && !g.__fundo) { g.__fundo = true; g.getZr().on("click", (ev) => { const pt = [ev.offsetX, ev.offsetY];
    if (g.containPixel({ gridIndex: 0 }, pt) && cliques["fundo:" + id]) cliques["fundo:" + id](g.convertFromPixel({ gridIndex: 0 }, pt)[0]); }); } }
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
        nota: b.vendaHoje != null ? (b.vendaDet ? "· último lote " + F.n(b.vendaDet.ultPreco, 2) : "· " + b.vendaRef) : "aguardando dados da Ypoti" },
      { rotulo: "Basis Paraguai × Brasil", valor: b.basisHoje, pct: true, dec: 1, sinal: true, nota: (f ? "contra " + f.cod + " em dólar" : "sem cotação da B3") + (b.brHoje && b.pyHoje && M.fx.brl ? " · DATAGRO " + F.pct(b.pyHoje / (b.brHoje.rs / 15 / M.fx.brl) - 1, 1, true) : "") },
      { rotulo: "Boi gordo B3 · " + (f ? f.cod : "BGI"), valor: f ? f.reais : null, dec: 2, un: "R$/@", nota: f && f.usd ? "US$ " + F.n(f.usd, 2) + "/kg · Paraguai " + F.n(f.pyMin, 2) + " a " + F.n(f.pyMax, 2) : "" },
      { rotulo: "Milho B3 · " + (fm ? fm.cod : "CCM"), valor: fm ? fm.reais : null, dec: 2, un: "R$/saca", nota: fm && fm.usd ? "US$ " + F.n(fm.usd, 0) + "/t · PY " + F.n(fm.pyMin, 0) + " a " + F.n(fm.pyMax, 0) + (m.cme.length ? " · CME " + F.n(m.cme[0].usd, 0) : "") : "" },
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
        linha("Brasil (DATAGRO)", par(b.brD, b.brV), COR.br, b.brUlt && b.brUlt.d > b.ancFim ? rotuloFim((v) => F.n(v, 2), COR.br) : {}),
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
        nossoM.length ? linha("Ypoti (compras do mês)", nossoM, COR.ypoti, Object.assign({ showSymbol: true }, rotuloFim(t0, COR.ypoti))) : null].filter(Boolean),
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

    // ---- curva do CCM (B3) e do milho de Chicago (CME), no tempo
    const cm = m.curva.filter((c) => c.usd), ch = m.cme;
    desenhar("g-milho-curva", cm.length || ch.length ? base({
      xAxis: eixoTempo({ axisLabel: { color: COR.t3, fontSize: rem() * 0.76, hideOverlap: true, formatter: (v) => F.mesAno(new Date(v).toISOString().slice(0, 10)) } }), yAxis: eixoY(t0),
      tooltip: Object.assign(base().tooltip, { formatter: (ps) => { const dia = new Date(ps[0].axisValue).toISOString().slice(0, 10), c = cm.find((x) => x.venc === dia), k = ch.find((x) => x.venc === dia);
        return (c ? "<b>" + c.cod + "</b> · " + F.dia(c.venc) + "<br>B3: R$ " + F.n(c.reais, 2) + "/saca" + (c.liquido ? "" : " (ajuste)") + " · dólar " + F.n(c.fx, 3) +
          "<br>Brasil: US$ " + F.n(c.usd, 0) + "/t<br>Paraguai pela mediana: US$ " + F.n(c.pyMed, 0) + "<br>Faixa do basis: US$ " + F.n(c.pyMin, 0) + " a " + F.n(c.pyMax, 0) +
          "<br><span style='opacity:.7'>basis do mês: " + F.n(c.bMin, 0) + " · " + F.n(c.bMed, 0) + " · " + F.n(c.bMax, 0) + " US$/t</span>" : "") +
          (k ? (c ? "<br>" : "") + "<b>Chicago " + k.cod + "</b> · " + F.dia(k.venc) + "<br>" + F.n(k.cents, 2) + " ¢/bushel = US$ " + F.n(k.usd, 0) + "/t" : ""); } }),
      legend: Object.assign(base().legend, { data: ["CCM em dólar", "Paraguai (mediana)", "Faixa do basis"].concat(ch.length ? ["Chicago (CME)"] : []).concat(m.milhoHoje != null ? ["Ypoti"] : []) }),
      series: [
        { name: "_base", type: "line", data: cm.map((c) => [c.venc, r1(c.pyMin)]), stack: "fx", stackStrategy: "all", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
        { name: "Faixa do basis", type: "line", data: cm.map((c) => [c.venc, r1(c.pyMax - c.pyMin)]), stack: "fx", stackStrategy: "all", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: COR.faixa }, itemStyle: { color: "rgba(234,242,236,.4)" }, silent: true, tooltip: { show: false } },
        linha("CCM em dólar", cm.map((c) => [c.venc, r1(c.usd)]), COR.br, Object.assign({ showSymbol: true }, rotuloFim(t0, COR.br))),
        linha("Paraguai (mediana)", cm.map((c) => [c.venc, r1(c.pyMed)]), COR.py, Object.assign({ showSymbol: true, lineStyle: { width: 2, color: COR.py, type: "dashed" } }, rotuloFim(t0, COR.py))),
      ].concat(ch.length ? [linha("Chicago (CME)", ch.map((c) => [c.venc, r1(c.usd)]), COR.amarelo, Object.assign({ showSymbol: true }, rotuloFim(t0, COR.amarelo)))] : [])
        .concat(m.milhoHoje != null ? [linhaRef("Ypoti", r1(m.milhoHoje), COR.ypoti, (v) => "Ypoti " + F.n(v, 0))] : []),
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
      { rotulo: "β · quilo produzido", valor: u.beta, un: "Gs/kg", nota: R.quadHoje ? "2º grau: " + F.n(R.quadHoje.b180, 0) + " em 180 kg · " + F.n(R.quadHoje.b360, 0) + " em 360 kg" : (M.fx.pyg ? "US$ " + F.n(u.beta / M.fx.pyg, 2) + " por kg vivo" : "") },
      { rotulo: "α · serviço da vaca (macho)", valor: u.aM / 1000, un: "mil Gs/cab", nota: "fêmea " + F.n(u.aF / 1000, 0) + " · peso do ágio aos 180 kg " + F.pct(u.aM / (u.aM + u.beta * 180), 0) },
      { rotulo: "Ágio do bezerro sobre o gordo", valor: ag ? ag.a180 : null, pct: true, dec: 0, sinal: true, nota: "180 kg, kg vivo · 360 kg " + F.pct(ag ? ag.a360 : null, 0, true) },
      { rotulo: "Nossas compras × mercado", valor: R.desvioRec != null ? Math.exp(R.desvioRec) - 1 : null, pct: true, dec: 1, sinal: true, destaque: true,
        nota: R.desvioRec != null ? F.n(R.cabRec, 0) + " cab · " + R.nRec + " compras · " + M.S.diasCompras + " dias · " + ({ vendedor: "peso do vendedor", balanca: "peso de balança", posto: "posto fazenda" })[R.baseCompra] : "aguardando dados da Ypoti" },
    ] : [{ rotulo: "Reposição", valor: null, nota: semDados }]);

    const ini = R.inicioJanela, ind = R.ind.filter((r) => r.d >= ini);
    const gs = (v) => F.n(v / 1000, 1);
    // negócios de leilão por fonte (machos), bolinha proporcional às cabeças; clicar abre a página da fonte
    const fontes = [...new Set(R.negocios.map((l) => l.fonte || "Outros"))].sort(), paleta = [COR.br, COR.amarelo, COR.magenta, COR.violeta, COR.t2];
    const corFonte = {}; fontes.forEach((f, i) => { corFonte[f] = paleta[Math.min(i, paleta.length - 1)]; });
    const pk = R.negocios.filter((l) => l.d >= ini).map((l) => l.pkg).concat(ind.map((r) => r.m180), ind.map((r) => r.m360)).filter((v) => v > 0).sort((x, y) => x - y);
    const yMin = pk.length ? Math.floor(C.quantil(pk, 0.01) / 1000) * 1000 : null, yMax = pk.length ? Math.ceil(C.quantil(pk, 0.99) / 1000) * 1000 : null;
    const tamNeg = (cab) => Math.max(rem() * 0.34, Math.min(rem() * 1.05, Math.sqrt(cab || 25) * rem() * 0.05));
    const dicaNeg = (p) => { const l = p.data.l, ref = M.repo.ind.length ? C.ultimoAte(M.repo.ind.map((r) => r.d), M.repo.ind)(l.d) : null, pr = ref ? C.precoKg(ref.beta, ref.cM, l.peso) : null;
      return "<b>" + l.fonte + "</b> · " + F.dia(l.d) + (l.feria ? "<br>" + l.feria + (l.lote ? " · lote " + l.lote : "") : "") +
        "<br>" + (l.catOrig || l.cat || "") + (l.cab ? " · " + F.n(l.cab, 0) + " cab" : " · cabeças não informadas") + " · " + F.n(l.peso, 0) + " kg" +
        "<br><b>Gs " + F.n(l.pkg, 0) + "/kg</b> · Gs " + F.n(l.pcab, 0) + "/cab" + (pr ? "<br>" + F.pct(l.pkg / pr - 1, 1, true) + " contra o indicador nesse peso" : "") +
        (l.depto ? "<br>" + l.depto + (l.vendedor ? " · " + l.vendedor : "") : (l.vendedor ? "<br>" + l.vendedor : "")) + (l.carimbo ? "<br>" + l.carimbo : "") + (l.obs ? "<br><span style='opacity:.75'>" + l.obs + "</span>" : "") +
        (l.url ? "<br><span style='opacity:.6'>clique para abrir a página da fonte</span>" : ""); };
    desenhar("g-repo-pesos", ind.length ? base({
      xAxis: eixoTempo(), yAxis: eixoY(gs, { min: yMin, max: yMax }),
      tooltip: Object.assign(base().tooltip, { trigger: "item", formatter: (p) => (p.data && p.data.l ? dicaNeg(p) : "<b>" + p.seriesName + "</b> · semana de " + F.dia(String(p.value[0]).slice(0, 10)) + "<br>Gs " + F.n(p.value[1], 0) + "/kg") }),
      series: [["180 kg", "m180"], ["230 kg", "m230"], ["300 kg", "m300"], ["360 kg", "m360"]].map(([n, k], i) =>
        linha(n, ind.map((r) => [r.d, r[k]]), COR.rampa[i], Object.assign(rotuloFim((v) => F.n(v, 0), COR.rampa[i]), { z: 4, showSymbol: true, symbolSize: rem() * 0.24, lineStyle: { width: 2.4, color: COR.rampa[i] } })))
        .concat(fontes.map((f) => ({ name: f, type: "scatter", z: 2, clip: true, data: R.negocios.filter((l) => (l.fonte || "Outros") === f && l.d >= ini).map((l) => ({ value: [l.d, l.pkg, l.cab], l })), symbolSize: (v) => tamNeg(v[2]),
          itemStyle: { color: corFonte[f], opacity: 0.42, borderColor: "rgba(6,19,12,.6)", borderWidth: 0.5 }, emphasis: { scale: 1.8, itemStyle: { opacity: 1 } } }))),
    }) : null, semDados);
    ligarClique("g-repo-pesos", (p) => { if (p.data && p.data.l && p.data.l.url) window.open(p.data.l.url, "_blank", "noopener"); });

    const agio = R.agio.filter((r) => r.d >= ini), nossas = R.compras.filter((c) => c.d >= ini && c.agio != null && c.sexo === "Macho");
    const nossasMes = [...C.porMes(nossas.map((c) => ({ d: c.d, v: c.agio, w: c.cab }))).entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([k, v]) => [k + "-15", +(v * 100).toFixed(1)]);
    desenhar("g-repo-agio", agio.length ? base({
      xAxis: eixoTempo(), yAxis: eixoY((v) => F.n(v, 0) + "%"),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : F.n(v, 0) + "%") }),
      series: [linha("Bezerro 180 kg", agio.map((r) => [r.d, r.a180 == null ? null : +(r.a180 * 100).toFixed(1)]), COR.rampa[0], rotuloFim((v) => F.n(v, 0) + "%", COR.rampa[0])),
        linha("Toretón 360 kg", agio.map((r) => [r.d, r.a360 == null ? null : +(r.a360 * 100).toFixed(1)]), COR.rampa[3], rotuloFim((v) => F.n(v, 0) + "%", COR.rampa[3])),
        nossasMes.length ? linha("Nossas compras (média do mês)", nossasMes, COR.ypoti, Object.assign({ showSymbol: true }, rotuloFim((v) => F.n(v, 0) + "%", COR.ypoti))) : null].filter(Boolean),
    }) : null, semDados);

    // ---- α no tempo (serviço da vaca)
    const daInd = (k, div) => ind.map((x) => [x.d, x[k] == null ? null : +(x[k] / div).toFixed(3)]);
    desenhar("g-repo-alfa", ind.length ? base({
      xAxis: eixoTempo(), yAxis: eixoY((v) => F.n(v, 1)),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : "Gs " + F.n(v, 2) + " milhões/cab") }),
      series: [linha("α macho", daInd("aM", 1e6), COR.py, rotuloFim((v) => F.n(v, 2), COR.py)), linha("α fêmea", daInd("aF", 1e6), COR.magenta, rotuloFim((v) => F.n(v, 2), COR.magenta))],
    }) : null, semDados);

    // ---- nuvem α + β·w (valor por cabeça) e hipérbole do ágio (preço por kg)
    if (u) {
      const mk = (sexo) => R.nuvem.filter((l) => l.sexo === sexo), W = [80, 110, 140, 170, 200, 230, 260, 290, 320, 350, 380, 410, 440];
      const nos = R.comprasRec.filter((c) => c.sexo === "Macho");
      const tam = (cab) => Math.max(rem() * 0.6, Math.min(rem() * 1.5, Math.sqrt(cab || 30) * rem() * 0.07));
      const tamL = (cab) => Math.max(rem() * 0.32, Math.min(rem() * 0.95, Math.sqrt(cab || 25) * rem() * 0.045));
      const pontos = (arr, ix, fy, cor, op, nome) => ({ name: nome, type: "scatter", xAxisIndex: ix, yAxisIndex: ix, data: arr.map((l) => [l.peso, fy(l), l.d, l.cab, (l.fonte || "Ypoti") + (l.feria ? " · " + l.feria : ""), l.pkg]), symbolSize: (v) => tamL(v[3]),
        itemStyle: { color: cor, opacity: op }, emphasis: { scale: 1.6 } });
      const nosso = (ix, fy) => ({ name: "Nossas compras", type: "scatter", xAxisIndex: ix, yAxisIndex: ix, z: 5, data: nos.map((c) => [c.peso, fy(c), c.d, c.cab, c.destino, c.pkg, c.desvio]), symbolSize: (v) => tam(v[3]),
        itemStyle: { color: COR.ypoti, opacity: 0.92, borderColor: "#06130C", borderWidth: 2 } });
      const reta = (nome, ix, f, cor) => ({ name: nome, type: "line", xAxisIndex: ix, yAxisIndex: ix, data: W.map((w) => [w, f(w)]), showSymbol: false, smooth: ix === 1, lineStyle: { width: 2.5, color: cor }, itemStyle: { color: cor }, z: 4, tooltip: { show: false } });
      const gq = R.quadHoje && R.quadHoje.d === u.d ? R.quadHoje.g : null;
      const estreito = (document.getElementById("g-repo-nuvem").clientWidth || 999) < 620;
      const r = rem(), tip = (p) => { const v = p.value; return "<b>" + p.seriesName + "</b> · " + F.dia(v[2]) + "<br>" + (v[3] ? F.n(v[3], 0) + " cab · " : "") + F.n(v[0], 0) + " kg<br>Gs " + F.n(v[5], 0) + "/kg · Gs " + F.n(v[5] * v[0], 0) + "/cab" +
        (v[4] ? "<br><span style='opacity:.7'>" + v[4] + "</span>" : "") + (v[6] != null ? "<br>" + F.pct(Math.exp(v[6]) - 1, 1, true) + " contra o indicador" : ""); };
      desenhar("g-repo-nuvem", base({
        tooltip: Object.assign(base().tooltip, { trigger: "item", formatter: tip }),
        legend: Object.assign(base().legend, { data: ["Leilões · macho", "Leilões · fêmea", "α + β·w macho", "α + β·w fêmea"].concat(gq ? ["Macho, 2º grau"] : []).concat(R.ajustePond ? ["Macho ponderado por cabeças"] : []).concat(nos.length ? ["Nossas compras"] : []) }),
        // no celular os dois painéis ficam um sobre o outro
        grid: estreito ? [{ left: r * 0.4, right: r * 1.2, top: r * 5.2, height: "34%", containLabel: true }, { left: r * 0.4, right: r * 1.2, top: "60%", bottom: r * 1.6, containLabel: true }]
          : [{ left: r * 0.4, right: "52%", top: r * 3.4, bottom: r * 1.6, containLabel: true }, { left: "52%", right: r * 1.2, top: r * 3.4, bottom: r * 1.6, containLabel: true }],
        title: [{ text: "Valor por cabeça = α + β · peso   (milhões de Gs)", left: r * 0.4, top: estreito ? r * 3.6 : r * 1.7, textStyle: { color: COR.t3, fontSize: r * 0.76, fontWeight: 400 } },
          { text: "Preço por quilo = β + α ÷ peso   (mil Gs/kg)", left: estreito ? r * 0.4 : "52%", top: estreito ? "55%" : r * 1.7, textStyle: { color: COR.t3, fontSize: r * 0.76, fontWeight: 400 } }],
        xAxis: [0, 1].map((i) => eixoX({ type: "value", gridIndex: i, min: 60, max: 460, name: "peso vivo (kg)", nameLocation: "middle", nameGap: r * 1.5, nameTextStyle: { color: COR.t3, fontSize: r * 0.74 } })),
        yAxis: [eixoY((v) => F.n(v, 1), { gridIndex: 0, scale: false }), eixoY((v) => F.n(v, 0), { gridIndex: 1 })],
        series: [pontos(mk("Fêmea"), 0, (l) => l.pkg * l.peso / 1e6, COR.magenta, 0.4, "Leilões · fêmea"), pontos(mk("Macho"), 0, (l) => l.pkg * l.peso / 1e6, COR.py, 0.55, "Leilões · macho"),
          reta("α + β·w fêmea", 0, (w) => (u.aF + u.beta * w) / 1e6, COR.magenta), reta("α + β·w macho", 0, (w) => (u.aM + u.beta * w) / 1e6, COR.py),
          pontos(mk("Fêmea"), 1, (l) => l.pkg / 1000, COR.magenta, 0.4, "Leilões · fêmea"), pontos(mk("Macho"), 1, (l) => l.pkg / 1000, COR.py, 0.55, "Leilões · macho"),
          reta("α + β·w fêmea", 1, (w) => (u.beta + u.aF / w) / 1000, COR.magenta),
          Object.assign(reta("α + β·w macho", 1, (w) => (u.beta + u.aM / w) / 1000, COR.py), { markLine: { silent: true, symbol: "none", data: [{ yAxis: u.beta / 1000 }], lineStyle: { color: COR.t2, type: "dashed", width: 1.2 },
            label: { formatter: "β = " + F.n(u.beta, 0), color: COR.tinta, fontSize: r * 0.76, position: "insideStartTop" } } }),
        ].concat(gq ? [0, 1].map((ix) => Object.assign(reta("Macho, 2º grau", ix, (w) => (ix ? u.beta * (gq.k + gq.c / w + gq.q * w) / 1000 : u.beta * (gq.k * w + gq.c + gq.q * w * w) / 1e6), COR.violeta),
          { smooth: true, lineStyle: { width: 2.2, color: COR.violeta } })) : [])
          .concat(R.ajustePond ? [0, 1].map((ix) => Object.assign(reta("Macho ponderado por cabeças", ix, (w) => (ix ? (R.ajustePond.beta + R.ajustePond.alfa / w) / 1000 : (R.ajustePond.alfa + R.ajustePond.beta * w) / 1e6), COR.tinta), { lineStyle: { width: 1.6, color: COR.tinta, type: "dashed" } })) : [])
          .concat(nos.length ? [nosso(0, (c) => c.pcab / 1e6), nosso(1, (c) => c.pkg / 1000)] : []),
      }));

      // ---- β: a reta (igual em todo peso) e a curva de 2º grau (derivada em 180 e 360 kg)
      const Q = R.quad.filter((q) => q.d >= ini), mil = (v) => (v == null || !isFinite(v) ? null : +(v / 1000).toFixed(2));
      desenhar("g-repo-beta", base({
        xAxis: eixoTempo(), yAxis: eixoY((v) => F.n(v, 0)),
        tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : "Gs " + F.n(v * 1000, 0) + "/kg") }),
        series: [linha("β da reta", daInd("beta", 1000), COR.amarelo, Object.assign({ lineStyle: { width: 2.6, color: COR.amarelo } }, rotuloFim((v) => F.n(v, 1), COR.amarelo)))]
          .concat(Q.length ? [linha("Curva em 180 kg", Q.map((q) => [q.d, mil(q.b180)]), COR.rampa[0], rotuloFim((v) => F.n(v, 1), COR.rampa[0])),
            linha("Curva em 360 kg", Q.map((q) => [q.d, mil(q.b360)]), COR.rampa[3], rotuloFim((v) => F.n(v, 1), COR.rampa[3]))] : []),
      }));
      // ---- valor do kg produzido ÷ preço do kg do animal (elasticidade do valor ao peso), em 180 e 360 kg
      const pc = (v) => (v == null || !isFinite(v) ? null : +(v * 100).toFixed(1));
      desenhar("g-repo-razao", Q.length ? base({
        xAxis: eixoTempo(), yAxis: eixoY((v) => F.n(v, 0) + "%"),
        legend: Object.assign(base().legend, { data: ["180 kg", "360 kg", { name: "Pela reta", itemStyle: { color: COR.t3 } }] }),
        tooltip: Object.assign(base().tooltip, { formatter: (ps) => { const q = Q[ps[0].dataIndex]; if (!q) return "";
          return "<b>Semana de " + F.dia(q.d) + "</b><br>180 kg: o kg a mais vale " + F.pct(q.rQ180, 0) + " do preço do kg<br>&nbsp;&nbsp;Gs " + F.n(q.b180, 0) + " ÷ Gs " + F.n(q.p180, 0) +
            "<br>360 kg: " + F.pct(q.rQ360, 0) + " · Gs " + F.n(q.b360, 0) + " ÷ Gs " + F.n(q.p360, 0) + "<br><span style='opacity:.7'>pela reta: " + F.pct(q.rL180, 0) + " e " + F.pct(q.rL360, 0) + "</span>"; } }),
        series: [linha("180 kg", Q.map((q) => [q.d, pc(q.rQ180)]), COR.rampa[0], rotuloFim((v) => F.n(v, 0) + "%", COR.rampa[0])),
          linha("360 kg", Q.map((q) => [q.d, pc(q.rQ360)]), COR.rampa[3], rotuloFim((v) => F.n(v, 0) + "%", COR.rampa[3])),
          linha("Pela reta", Q.map((q) => [q.d, pc(q.rL180)]), COR.rampa[0], { lineStyle: { width: 1.2, type: "dashed", color: COR.rampa[0], opacity: 0.7 } }),
          linha("Pela reta", Q.map((q) => [q.d, pc(q.rL360)]), COR.rampa[3], { lineStyle: { width: 1.2, type: "dashed", color: COR.rampa[3], opacity: 0.7 } })],
      }) : null, "Faltam lotes para estimar a curva de 2º grau.");
    } else { ["g-repo-nuvem", "g-repo-beta", "g-repo-razao"].forEach((id) => desenhar(id, null, semDados)); }
  }

  // ================================================================== TELA 3 — lucratividade
  const lembra = { ler(k, p) { try { return localStorage.getItem(k) || p; } catch (e) { return p; } }, gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* só nesta sessão */ } } };
  let lucroModo = lembra.ler("mb:lucroModo", "usd"), operModo = lembra.ler("mb:operModo", "real"), mesFixo = null, ultimoM = null;
  /** Solta o mês fixado pelo clique (ao trocar de tela a conta volta para hoje). */
  function soltarMes() { mesFixo = null; }

  function telaLucro(M) {
    ultimoM = M;
    const L = M.lucro, r = rem(), fix = mesFixo ? L.serie.find((s) => s.mes === mesFixo) : null;
    const A = fix ? fix.r : L.atual, G = A.global, R = A.recria, K = A.conf, p = fix ? fix.r.entrada : L.pHoje, quando = fix ? F.mesAno(fix.mes + "-01") : "hoje";
    const u0 = (v) => F.n(v, 0), sufixo = fix ? " · " + quando : "";
    kpis("kpis-lucro", [
      { rotulo: "Lucro do ciclo completo" + sufixo, valor: G.lucro, dec: 0, un: "US$/cab", destaque: true, nota: "desmamante de 180 kg até o abate · " + F.n(G.ciclo, 0) + " dias" },
      { rotulo: "TIR do ciclo" + sufixo, valor: G.tir, pct: true, dec: 1, nota: "ao ano, sobre o que foi desembolsado" },
      { rotulo: "Recria (com a RIP)", valor: R.lucro, dec: 0, un: "US$/cab", nota: "TIR " + F.pct(R.tir, 0) + " · 180 → " + F.n(R.pesoFim, 0) + " kg" },
      { rotulo: "Confinamento", valor: K.lucro, dec: 0, un: "US$/cab", nota: "TIR " + F.pct(K.tir, 0) + " · " + F.n(K.dias, 0) + " dias de cocho" },
      { rotulo: "Ponto de equilíbrio do gordo", valor: G.equilibrio, dec: 2, un: "US$/kg carcaça", nota: (fix ? "preço do mês " : "nosso preço ") + F.n(p.venda, 2) + " · folga " + F.n(p.venda - G.equilibrio, 2) },
      { rotulo: "Equilíbrio só do confinamento", valor: K.equilibrio, dec: 2, un: "US$/kg carcaça", nota: "comprando o toretón a " + F.n(p.toreton, 0) + " Gs/kg" },
    ]);

    // ---- resultado (US$/cab) ou TIR (ao ano) de cada etapa; clicar num mês fixa a conta naquele mês
    const S = L.serie, x = S.map((s) => s.mes + "-15"), tir = lucroModo === "tir";
    const val = (s, k) => { const e = s.r[k], v = tir ? (e.tir == null ? null : e.tir * 100) : e.lucro; return v == null || !isFinite(v) ? null : +v.toFixed(1); };
    const fy = tir ? (v) => F.n(v, 0) + "%" : u0;
    const marcaMes = fix ? [{ xAxis: fix.mes + "-15", lineStyle: { color: COR.tinta, width: 1.5, type: "solid" }, label: { show: true, formatter: quando, color: COR.tinta, fontSize: r * 0.78, position: "insideEndTop", backgroundColor: "rgba(6,19,12,.6)", padding: [2, 5], borderRadius: 4 } }] : [];
    const etapa = (nome, k, cor, extra) => linha(nome, S.map((s, i) => [x[i], val(s, k)]), cor, Object.assign(rotuloFim(fy, cor), extra || {}));
    document.getElementById("sub-lucro-serie").textContent = tir ? "TIR ao ano de cada etapa, com os preços e a zootecnia de cada mês" : "US$ por cabeça, com os preços e a zootecnia de cada mês";
    document.querySelectorAll("#alt-lucro button").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.modo === lucroModo)));
    desenhar("g-lucro-serie", S.length > 1 ? base({
      xAxis: eixoTempo(), yAxis: eixoY(fy, { scale: false }),
      tooltip: Object.assign(base().tooltip, { valueFormatter: (v) => (v == null ? "–" : tir ? F.n(v, 0) + "% ao ano" : "US$ " + F.n(v, 0) + "/cab") }),
      series: [etapa("Ciclo completo", "global", COR.tinta, { lineStyle: { width: 3, color: COR.tinta }, z: 5 }), etapa("Recria (com a RIP)", "recria", COR.br),
        etapa("Confinamento", "conf", COR.violeta, { markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: COR.eixo, width: 1 }, label: { show: false } }].concat(marcaMes) } })],
    }) : null, "Sem lotes abatidos para montar a série (a ponte de dados não respondeu).");
    ligarFundo("g-lucro-serie", (dataX) => {
      const alvo = new Date(dataX).toISOString().slice(0, 7), perto = S.reduce((a, s) => (Math.abs(C.difDias(s.mes + "-15", alvo + "-15")) < Math.abs(C.difDias(a.mes + "-15", alvo + "-15")) ? s : a), S[0]);
      mesFixo = perto.mes === mesFixo || perto.mes === S[S.length - 1].mes ? null : perto.mes; telaLucro(ultimoM);
    });

    // ---- a operação do confinamento mês a mês (réplica do gráfico da apresentação): compra + engorda contra a receita
    const mercado = operModo === "mercado", Op = S.filter((s) => s.oper.receita != null && s.oper.engorda != null && (mercado || s.oper.compra != null));
    const xo = Op.map((s) => s.mes + "-15"), compra = Op.map((s) => +(mercado ? s.oper.compraMercado : s.oper.compra).toFixed(1));
    const corCompra = "#a8dcc3", corEngorda = "#2f8a5f";
    document.querySelectorAll("#alt-oper button").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.modo === operModo)));
    document.getElementById("sub-lucro-oper").textContent = mercado ? "US$/cab, toretón a preço do mês" : "US$/cab, custos e receita reais";
    desenhar("g-lucro-oper", Op.length > 1 ? base({
      xAxis: eixoTempo(), yAxis: eixoY(u0, { scale: false }),
      legend: Object.assign(base().legend, { data: [mercado ? "Compra do boi magro (toretón do mês)" : "Custo de compra do boi magro", "Custo de engorda", "Receita com a venda"] }),
      tooltip: Object.assign(base().tooltip, { formatter: (ps) => { const i = ps[0].dataIndex, s = Op[i], c = compra[i], e = s.oper.engorda, v = s.oper.receita;
        return "<b>" + F.mesAno(s.mes + "-01") + "</b><br>Compra do boi magro: US$ " + u0(c) + "<br>Engorda: US$ " + u0(e) + "<br>Receita: US$ " + u0(v) + "<br><b>Margem: US$ " + u0(v - c - e) + "/cab</b>"; } }),
      series: [
        { name: mercado ? "Compra do boi magro (toretón do mês)" : "Custo de compra do boi magro", type: "line", stack: "custo", data: xo.map((d, i) => [d, compra[i]]), symbol: "none", lineStyle: { width: 0 }, areaStyle: { color: corCompra, opacity: 0.55 }, itemStyle: { color: corCompra }, smooth: 0.3 },
        { name: "Custo de engorda", type: "line", stack: "custo", data: xo.map((d, i) => [d, +Op[i].oper.engorda.toFixed(1)]), symbol: "none", lineStyle: { width: 0 }, areaStyle: { color: corEngorda, opacity: 0.85 }, itemStyle: { color: corEngorda }, smooth: 0.3 },
        linha("Receita com a venda", xo.map((d, i) => [d, +Op[i].oper.receita.toFixed(1)]), COR.tinta, Object.assign({ lineStyle: { width: 2.6, color: COR.tinta }, smooth: 0.3, z: 5 }, rotuloFim(u0, COR.tinta),
          marcaMes.length ? { markLine: { silent: true, symbol: "none", data: marcaMes } } : {})),
      ],
    }) : null, "Sem resultados de confinamento para montar o gráfico.");

    // ---- sensibilidade (lucro do ciclo × preço do gordo × preço do desmamante), no mês fixado ou hoje
    const sens = fix ? { dv: L.sens.dv, db: L.sens.db, z: L.sens.db.map((b) => L.sens.dv.map((v) => C.lucroYpoti(C.mesclar(p, { venda: p.venda + v, desmamante: p.desmamante * (1 + b) })).global.lucro)) } : L.sens;
    const z = sens.z, flat = [].concat.apply([], z), lim = Math.max.apply(null, flat.map(Math.abs)) || 1;
    document.getElementById("sub-lucro-sens").textContent = "Lucro do ciclo completo, US$ por cabeça" + (fix ? ", com os preços de " + quando : "");
    desenhar("g-lucro-sens", base({
      grid: { left: r * 0.4, right: r * 0.6, top: r * 1.9, bottom: r * 1.8, containLabel: true }, legend: { show: false },
      tooltip: Object.assign(base().tooltip, { trigger: "item", formatter: (q) => "Gordo a US$ " + F.n(p.venda + sens.dv[q.value[0]], 2) + "/kg<br>Desmamante a Gs " + F.n(p.desmamante * (1 + sens.db[q.value[1]]), 0) + "/kg<br><b>US$ " + F.n(q.value[2], 0) + "/cab</b>" }),
      xAxis: eixoX({ type: "category", data: sens.dv.map((d) => F.n(p.venda + d, 2)), name: "preço do gordo (US$/kg carcaça)", nameLocation: "middle", nameGap: r * 1.7, nameTextStyle: { color: COR.t3, fontSize: r * 0.74 }, splitArea: { show: false } }),
      yAxis: { type: "category", data: sens.db.map((d) => F.n(p.desmamante * (1 + d) / 1000, 1)), name: "desmamante (mil Gs/kg)", nameTextStyle: { color: COR.t3, fontSize: r * 0.74, align: "left" }, nameGap: r * 0.5,
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: COR.t3, fontSize: r * 0.76 } },
      visualMap: { show: false, min: -lim, max: lim, dimension: 2, inRange: { color: ["#b23233", "#5a3030", "#2c3330", "#1f5a2a", "#0c8f22"] } },
      series: [{ type: "heatmap", data: [].concat.apply([], z.map((lin, j) => lin.map((v, i) => (i === 3 && j === 3 ? { value: [i, j, +v.toFixed(0)], itemStyle: { borderColor: COR.tinta, borderWidth: 3 } } : [i, j, +v.toFixed(0)])))), itemStyle: { borderColor: "rgba(6,19,12,.9)", borderWidth: 2, borderRadius: 5 },
        label: { show: true, color: COR.tinta, fontSize: r * 0.8, fontWeight: 600, formatter: (q) => F.n(q.value[2], 0) }, emphasis: { itemStyle: { borderColor: COR.tinta } } }],
    }));

    // ---- a conta (como na apresentação): de hoje ou do mês fixado
    const H = L.atual, ph = L.pHoje;
    const lin = (rot, a, b2, g, cls) => "<tr" + (cls ? ' class="' + cls + '"' : "") + "><th>" + rot + "</th><td>" + a + "</td><td>" + b2 + "</td><td>" + g + "</td></tr>";
    const comp = (nome, vMes, vHoje, dec, un) => "<tr><th>" + nome + "</th>" + (fix ? "<td class='forte'>" + F.n(vMes, dec) + (un || "") + "</td>" : "") +
      "<td class='" + (fix ? "apagado" : "forte") + "'>" + F.n(vHoje, dec) + (un || "") + "</td></tr>";
    document.getElementById("tit-lucro-conta").textContent = fix ? "A conta de " + quando : "A conta de hoje";
    document.getElementById("bt-hoje").hidden = !fix;
    document.getElementById("conta-lucro").innerHTML =
      '<table class="conta"><thead><tr><th></th><th>Recria</th><th>Confin.</th><th>Ciclo</th></tr></thead><tbody>' +
      lin("Peso de entrada → saída (kg)", u0(R.pesoIni) + " → " + u0(R.pesoFim), u0(K.pesoIni) + " → " + u0(K.pesoFim), u0(R.pesoIni) + " → " + u0(K.pesoFim)) +
      lin("Dias", u0(R.dias), u0(K.dias), u0(G.ciclo)) +
      lin("Receita", u0(R.receita), u0(K.receita), u0(K.receita), "sep") +
      lin("Compra do animal", u0(R.compra), u0(K.compra), u0(R.compra)) +
      lin("Custo da etapa", u0(R.custo), u0(K.engorda), u0(R.custo + K.engorda)) +
      lin("Lucro (US$/cab)", u0(R.lucro), u0(K.lucro), u0(G.lucro), "total") +
      lin("TIR ao ano", F.pct(R.tir, 0), F.pct(K.tir, 0), F.pct(G.tir, 1)) +
      "</tbody></table>" +
      '<table class="conta premissas"><thead><tr><th>O que entrou na conta</th>' + (fix ? "<th>" + quando + "</th>" : "") + "<th>Hoje</th></tr></thead><tbody>" +
      comp("Desmamante 180 kg (Gs/kg)", p.desmamante, ph.desmamante, 0) + comp("Toretón, entrada do confinamento (Gs/kg)", p.toreton, ph.toreton, 0) +
      comp("Gordo, nosso preço (US$/kg carcaça)", p.venda, ph.venda, 2) + comp("Câmbio (Gs/US$)", p.cambio, ph.cambio, 0) +
      comp("Custo da recria (US$/cab)", p.custoRecria, ph.custoRecria, 0) +
      comp("Peso de entrada no confinamento (kg)", p.pesoEntrada, ph.pesoEntrada, 0) + comp("Peso de saída (kg)", p.pesoSaida, ph.pesoSaida, 0) +
      comp("Rendimento de carcaça", p.rc * 100, ph.rc * 100, 1, "%") + comp("Dias de cocho", p.dias, ph.dias, 0) +
      comp("Diária, dieta e operacional (US$/cab)", p.diaria, ph.diaria, 2) + comp("Custo do kg ganho no cocho (US$)", K.custoKgGanho, H.conf.custoKgGanho, 2) +
      "</tbody></table>" +
      '<table class="conta premissas"><thead><tr><th>Fluxo de caixa do ciclo</th><th>Dia</th><th>US$/cab</th></tr></thead><tbody>' +
      G.fluxos.map((f) => "<tr><th>" + f.evento + "</th><td>" + F.n(f.dia, 0) + "</td><td>" + (f.valor > 0 ? "+" : "") + F.n(f.valor, 0) + "</td></tr>").join("") +
      "<tr class='total'><th>Lucro · TIR " + F.pct(G.tir, 1) + " ao ano</th><td>" + F.n(G.ciclo, 0) + "</td><td>" + F.n(G.lucro, 0) + "</td></tr></tbody></table>" +
      '<p class="nota-conta">' + (fix ? "Conta de " + quando + ": " + (L.usaYpoti ? "desmamante e toretón pelo que a Ypoti pagou no mês (ou na última compra)" : "desmamante e toretón pelo indicador dos leilões") +
          ", câmbio médio do mês, " + (fix.vendaEstimada ? "preço do gordo estimado (mês sem venda nossa)" : "a nossa venda média do mês") +
          (fix.zootEstimada ? " e zootecnia interpolada (mês sem abate)." : " e pesos, dias, diária e rendimento dos lotes abatidos no mês.") :
        "Hoje: " + (L.usaYpoti ? "desmamante e toretón pela média das compras da Ypoti dos últimos 60 dias" : "desmamante e toretón pelo indicador dos leilões") + "; zootecnia dos lotes abatidos em " +
          L.fechados.map((m) => F.mesAno(m + "-01")).join(", ") + " (" + F.n(L.nLotes, 0) + " cab); preço do gordo: " + L.vendaRef + ".") +
      " A recria leva a RIP junto, a custo fixo por cabeça, como na apresentação Rentabilidade Histórica. Clique num mês do gráfico para ver a conta daquele mês.</p>";
  }

  // ================================================================== TELA 4 — câmbio (BCP) e análise técnica
  const NOTAS = [{ t: "Forte queda", c: "#dc3c3d" }, { t: "Queda", c: "#c4776f" }, { t: "Neutro", c: "#8c9a92" }, { t: "Alta", c: "#6dbd80" }, { t: "Forte alta", c: "#0aac23" }];
  const notaDe = (v) => (v == null || !isFinite(v) ? null : NOTAS[v >= 1.2 ? 4 : v >= 0.4 ? 3 : v > -0.4 ? 2 : v > -1.2 ? 1 : 0]);

  function telaCambio(M) {
    noticias(M);
    const X = M.cambio, r = rem(), semDados = M.S.chave ? "Aguardando o câmbio do BCP (ponte de dados não respondeu)." : "Falta a chave da ponte neste navegador: abra a engrenagem (⚙), cole a chave de acesso e salve.";
    const ids = ["g-cambio-hist", "g-cambio-termo", "g-cambio-dia", "g-cambio-ifr"];
    if (!X) {
      kpis("kpis-cambio", [{ rotulo: "Dólar BCP", valor: null, nota: "aguardando dados" }]);
      ids.forEach((id) => desenhar(id, null, semDados)); document.getElementById("tecnica-cambio").innerHTML = '<p class="vazio">' + semDados + "</p>"; document.getElementById("metodos-cambio").innerHTML = ""; document.getElementById("termo-hist").innerHTML = ""; return;
    }
    const u = X.ult, n = X.dias.length, g0 = (v) => F.n(v, 0), g2 = (v) => F.n(v, 2), dm = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
    const viva = X.aberto ? '<i class="luz-viva"></i>' : "", P = X.proj ? X.proj.pontos : [], p30 = P[20] || null, p60 = P[41] || null;
    const sint = notaDe(X.sintese), validos = X.metodos.filter((m) => m.nota != null), aFavor = validos.filter((m) => X.sintese != null && m.nota * X.sintese > 0).length;
    const bps = (v) => (v > 0 ? "+" : "") + F.n(v, 1) + " bps";
    kpis("kpis-cambio", [
      { rotulo: viva + "Compra · BCP", valor: u.compra, dec: 2, un: "Gs/US$", destaque: true, nota: u.h + " · " + dm(X.hoje.d) + (X.aberto ? " · mercado aberto" : " · fechado") },
      { rotulo: viva + "Venda · BCP", valor: u.venda, dec: 2, un: "Gs/US$", destaque: true, nota: "média do dia " + g2(X.ref) },
      { rotulo: "Spread compra–venda", valor: u.spread, dec: 0, un: "bps", nota: "mediana de 30 dias: " + F.n(X.spread30, 0) + " bps" },
      { rotulo: "Dólar no dia", valor: X.varDia, pct: true, dec: 2, sinal: true, neutro: true, delta: X.varDia, deltaTxt: X.ontem ? "contra " + g2(X.ontem.c) + " de ontem" : "", nota: "" },
      { rotulo: "Termômetro técnico", texto: sint ? '<span style="color:' + sint.c + '">' + sint.t + "</span>" : "–", nota: sint ? aFavor + " de " + validos.length + " métodos na mesma direção" : "faltam dias de histórico" },
      { rotulo: "Projeção para 30 dias", valor: p30 ? p30.med : null, dec: 0, un: "Gs/US$", nota: p30 ? "80% de confiança: " + g0(p30.i80) + " a " + g0(p30.s80) : "faltam dias de histórico" },
      { rotulo: "Melhor hora para vender dólar", texto: X.melhorVenda ? X.melhorVenda.h : "–", nota: X.melhorVenda ? "compra " + bps(X.melhorVenda.compra) + " sobre a média do dia · spread " + F.n(X.melhorVenda.spread, 0) : "" },
    ]);

    // ---- histórico em velas, médias, picos e vales + leque da projeção (≈ 60 dias)
    const datas = X.dias.map((x) => dm(x.d)), cat = datas.concat(P.map((q) => dm(q.d))), conf = X.pv, ultF = +X.fech[n - 1].toFixed(1);
    const marca = (tipo) => conf.filter((q) => q.tipo === tipo).map((q) => ({ value: [q.i, +q.v.toFixed(1)], confirmado: q.confirmado }));
    const fut = (f) => X.dias.map((_, i) => (i === n - 1 ? f(null) : null)).concat(P.map((q) => +f(q).toFixed(1)));
    const leque = (nome, f, cor) => ({ name: nome, type: "line", data: fut(f), stack: "leque", stackStrategy: "all", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: cor, opacity: 1 }, itemStyle: { color: cor }, silent: true, tooltip: { show: false }, connectNulls: false, z: 1 });
    const c80 = "rgba(234,242,236,.10)", c50 = "rgba(234,242,236,.22)";
    desenhar("g-cambio-hist", base({
      grid: { left: r * 0.4, right: r * 1.4, top: r * 2.6, bottom: r * 0.3, containLabel: true },
      legend: Object.assign(base().legend, { data: ["Dólar (vela do dia)", "Média de 10 dias", "Média de 50 dias", "Picos", "Vales"].concat(P.length ? ["Projeção (mediana)", { name: "50% de confiança", itemStyle: { color: "rgba(234,242,236,.5)" } }, { name: "80% de confiança", itemStyle: { color: "rgba(234,242,236,.25)" } }] : []) }),
      xAxis: eixoX({ type: "category", data: cat, boundaryGap: true, axisLabel: { color: COR.t3, fontSize: r * 0.76, hideOverlap: true, interval: Math.max(0, Math.floor(cat.length / 13) - 1) } }),
      yAxis: eixoY(g0, { min: (v) => Math.floor((v.min - (v.max - v.min) * 0.09) / 50) * 50, max: (v) => Math.ceil((v.max + (v.max - v.min) * 0.09) / 50) * 50 }),
      tooltip: Object.assign(base().tooltip, { formatter: (ps) => { const i = ps[0].dataIndex;
        if (i >= n) { const q = P[i - n]; return "<b>Projeção para " + F.dia(q.d) + "</b> · " + q.k + " pregões à frente<br>mediana " + g0(q.med) + "<br>50% de confiança: " + g0(q.i50) + " a " + g0(q.s50) + "<br>80% de confiança: " + g0(q.i80) + " a " + g0(q.s80); }
        const x = X.dias[i];
        return "<b>" + F.dia(x.d) + "</b><br>abertura " + g2(x.o) + " · máxima " + g2(x.h) + "<br>mínima " + g2(x.l) + " · fechamento " + g2(x.c) + "<br>compra " + g2(x.compra) + " · venda " + g2(x.venda) +
          (X.m10[i] != null ? "<br>média 10: " + g2(X.m10[i]) : "") + (X.m50[i] != null ? " · média 50: " + g2(X.m50[i]) : "") + (X.ifr[i] != null ? "<br>IFR 14: " + F.n(X.ifr[i], 0) : ""); } }),
      series: [
        { name: "Dólar (vela do dia)", type: "candlestick", data: X.dias.map((x) => [+x.o.toFixed(1), +x.c.toFixed(1), +x.l.toFixed(1), +x.h.toFixed(1)]), barMaxWidth: r * 0.55,
          itemStyle: { color: COR.bom, color0: COR.ruim, borderColor: COR.bom, borderColor0: COR.ruim },
          markLine: { silent: true, symbol: "none", data: [X.resistencia ? { yAxis: +X.resistencia.toFixed(1), name: "Resistência" } : null, X.suporte ? { yAxis: +X.suporte.toFixed(1), name: "Suporte" } : null].filter(Boolean),
            lineStyle: { color: COR.t2, type: "dashed", width: 1.2 }, label: { formatter: (q) => q.name + " " + F.n(q.value, 0), color: COR.tinta, fontSize: r * 0.76, position: "insideStartTop", backgroundColor: "rgba(6,19,12,.55)", padding: [2, 4], borderRadius: 4 } } },
        linha("Média de 10 dias", X.m10.map((v) => (v == null ? null : +v.toFixed(1))), COR.amarelo, { connectNulls: false }),
        linha("Média de 50 dias", X.m50.map((v) => (v == null ? null : +v.toFixed(1))), COR.violeta, { connectNulls: false }),
        { name: "_zz", type: "line", data: conf.map((q) => [q.i, +q.v.toFixed(1)]), symbol: "none", lineStyle: { color: COR.t3, width: 1, type: "dotted" }, silent: true, tooltip: { show: false }, z: 1 },
        { name: "Picos", type: "scatter", data: marca("pico"), symbol: "triangle", symbolRotate: 180, symbolSize: r * 0.8, symbolOffset: [0, -r * 0.75], itemStyle: { color: COR.magenta, borderColor: "#06130C", borderWidth: 1 }, z: 6, tooltip: { show: false },
          label: { show: true, position: "top", distance: r * 0.9, formatter: (q) => F.n(q.value[1], 0), color: COR.tinta, fontSize: r * 0.74, fontWeight: 600 }, labelLayout: { hideOverlap: true } },
        { name: "Vales", type: "scatter", data: marca("vale"), symbol: "triangle", symbolSize: r * 0.8, symbolOffset: [0, r * 0.75], itemStyle: { color: COR.py, borderColor: "#06130C", borderWidth: 1 }, z: 6, tooltip: { show: false },
          label: { show: true, position: "bottom", distance: r * 0.9, formatter: (q) => F.n(q.value[1], 0), color: COR.tinta, fontSize: r * 0.74, fontWeight: 600 }, labelLayout: { hideOverlap: true } },
      ].concat(P.length ? [
        leque("_leque", (q) => (q ? q.i80 : ultF), "rgba(0,0,0,0)"), leque("_80a", (q) => (q ? q.i50 - q.i80 : 0), c80), leque("50% de confiança", (q) => (q ? q.s50 - q.i50 : 0), c50), leque("80% de confiança", (q) => (q ? q.s80 - q.s50 : 0), c80),
        linha("Projeção (mediana)", fut((q) => (q ? q.med : ultF)), COR.tinta, { connectNulls: false, lineStyle: { width: 2, color: COR.tinta, type: "dashed" }, z: 5,
          markLine: { silent: true, symbol: "none", data: [{ xAxis: n - 1 }], lineStyle: { color: COR.t3, width: 1, type: "solid" }, label: { formatter: "hoje", color: COR.t2, fontSize: r * 0.72, position: "insideEndTop" } } }),
        { name: "_marcos", type: "scatter", data: [p30 ? [n + 20, +p30.med.toFixed(1), "30 dias"] : null, p60 ? [n + 41, +p60.med.toFixed(1), "60 dias"] : null].filter(Boolean), symbolSize: r * 0.6, itemStyle: { color: COR.tinta, borderColor: "#06130C", borderWidth: 2 }, z: 7, tooltip: { show: false },
          label: { show: true, position: "top", distance: r * 0.5, formatter: (q) => q.value[2] + "\n" + F.n(q.value[1], 0), color: COR.tinta, fontSize: r * 0.76, fontWeight: 600, lineHeight: r * 0.95, backgroundColor: "rgba(6,19,12,.6)", padding: [3, 6], borderRadius: 5, align: "center" } },
      ] : []),
    }));

    // ---- termômetro técnico: síntese dos métodos (−2 forte queda … +2 forte alta)
    const elT = document.getElementById("g-cambio-termo"), wT = elT.clientWidth || 300, hT = elT.clientHeight || 150, raio = Math.max(36, Math.min(hT * 0.6, wT * 0.4));
    desenhar("g-cambio-termo", X.sintese != null ? { backgroundColor: "transparent", animationDuration: 1400, animationEasing: "elasticOut",
      series: [{ type: "gauge", min: -2, max: 2, startAngle: 180, endAngle: 0, center: [wT / 2, hT * 0.68], radius: raio, splitNumber: 4,
        axisLine: { roundCap: false, lineStyle: { width: Math.max(8, raio * 0.16), color: NOTAS.map((q, i) => [(i + 1) / 5, q.c]) } },
        pointer: { length: "68%", width: Math.max(4, r * 0.34), itemStyle: { color: COR.tinta } }, anchor: { show: true, size: r * 0.75, itemStyle: { color: COR.tinta, borderColor: "#06130C", borderWidth: 2 } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, title: { show: false },
        detail: { show: true, offsetCenter: [0, "30%"], formatter: () => "{t|" + sint.t.toUpperCase() + "}" + (X.graus != null ? "  {g|" + Math.round(X.graus) + "/100}" : ""), backgroundColor: "rgba(6,19,12,.5)", padding: [3, 8], borderRadius: 6,
          rich: { t: { color: sint.c, fontSize: r * 1.02, fontWeight: 700 }, g: { color: COR.tinta, fontSize: r * 0.82, fontWeight: 600 } } },
        data: [{ value: +X.sintese.toFixed(2) }] }] } : null, "Faltam dias de histórico para a leitura técnica.");
    const escala = (nota) => '<span class="escala">' + NOTAS.map((q, i) => '<i' + (nota != null && i === nota + 2 ? ' class="on" style="background:' + q.c + '"' : "") + "></i>").join("") + "</span>";
    const linhaMet = (m) => "<tr><th>" + m.nome + "<small>" + m.det + "</small></th><td>" + escala(m.nota) + "</td><td class='rec' style='color:" + (m.nota == null ? "inherit" : NOTAS[m.nota + 2].c) + "'>" + (m.nota == null ? "–" : NOTAS[m.nota + 2].t) + "</td></tr>";
    const grupo = (tipo, titulo) => { const ms = X.metodos.filter((m) => m.tipo === tipo); return ms.length ? "<tr class='grupo'><th colspan='3'>" + titulo + "</th></tr>" + ms.map(linhaMet).join("") : ""; };
    document.getElementById("metodos-cambio").innerHTML = '<table class="conta metodos"><tbody>' + grupo("tendência", "Seguidores de tendência · dizem para onde o dólar está indo") +
      grupo("oscilador", "Osciladores · avisam de exagero, leitura contrária") + "</tbody></table>";
    // ---- ao lado do ponteiro: o que o dólar fez depois, nas vezes em que o termômetro marcou parecido (BCP desde 2010)
    const TH = X.termoHist, elH = document.getElementById("termo-hist");
    const pp = (v) => (v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + F.n(Math.abs(v) * 100, 1) + "%");
    if (!TH || !TH.nDias) elH.innerHTML = X.graus == null ? "" : '<p class="th-rod">' + (TH ? "Nenhum dia desde " + (TH.desde || "2010").slice(0, 4) + " com leitura parecida no dólar do BCP." : "Aguardando a série longa do BCP.") + "</p>";
    else {
      const lo = Math.max(0, Math.round(TH.graus - TH.tol)), hi = Math.min(100, Math.round(TH.graus + TH.tol)), t30 = TH.horizontes.find((h) => h.h === 30);
      elH.innerHTML = '<p class="th-tit">Nas vezes em que marcou de ' + lo + " a " + hi + "/100, o dólar depois:</p>" +
        '<table class="th-tab"><thead><tr><th></th><th>mediana</th><th>80% das vezes</th><th>subiu</th></tr></thead><tbody>' +
        TH.horizontes.map((h) => { const p = h.parecido; return "<tr><th>" + h.h + " dias</th><td>" + (p ? pp(p.med) : "–") + "</td><td>" + (p ? pp(p.p10) + " a " + pp(p.p90) : "–") + "</td><td>" + (p ? F.n(p.subiu * 100, 0) + "%" : "–") + "</td></tr>"; }).join("") +
        '</tbody></table><p class="th-rod">' + F.n(TH.nDias, 0) + " dias em " + TH.episodios + " episódios desde " + TH.desde.slice(0, 4) +
        (t30 && t30.todos ? " · em qualquer dia, 30 dias: " + pp(t30.todos.med) + " (" + pp(t30.todos.p10) + " a " + pp(t30.todos.p90) + ")" : "") + "</p>";
    }

    // ---- o dia: compra e venda de hoje sobre o dia típico dos últimos 60 pregões
    const cortes = [...new Set(["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00"].concat(X.tipico.map((t) => t.h)))].sort();
    const reaisHoje = X.hoje.cortes.filter((c) => !c.semNeg), refHoje = C.media(reaisHoje.map((c) => c.medio));
    const doDia = (campo) => cortes.map((h) => { const c = reaisHoje.find((q) => q.h === h); return c ? +c[campo].toFixed(2) : null; });
    const tipo = (campo) => cortes.map((h) => { const t = X.tipico.find((q) => q.h === h && q.n >= 10); return t ? +(refHoje * (1 + t[campo] / 1e4)).toFixed(2) : null; });
    const tc = tipo("compra"), tv = tipo("venda"), mv = X.melhorVenda;
    desenhar("g-cambio-dia", base({
      xAxis: eixoX({ type: "category", data: cortes, boundaryGap: false }), yAxis: eixoY(g0),
      legend: Object.assign(base().legend, { data: ["Compra hoje", "Venda hoje", { name: "Dia típico (60 pregões)", itemStyle: { color: "rgba(234,242,236,.4)" } }] }),
      tooltip: Object.assign(base().tooltip, { formatter: (ps) => { const h = ps[0].axisValue, c = reaisHoje.find((q) => q.h === h), t = X.tipico.find((q) => q.h === h);
        return "<b>" + h + "</b>" + (c ? "<br>hoje: compra " + g2(c.compra) + " · venda " + g2(c.venda) + "<br>spread de hoje: " + F.n(c.spread, 0) + " bps" : "<br>hoje: sem corte neste horário") +
          (t ? "<br><span style='opacity:.8'>dia típico, contra a média do dia:<br>compra " + bps(t.compra) + " · venda " + bps(t.venda) + "<br>spread típico " + F.n(t.spread, 0) + " bps · " + t.n + " pregões</span>" : ""); } }),
      series: [
        { name: "_base", type: "line", data: tc, stack: "tip", stackStrategy: "all", symbol: "none", lineStyle: { color: COR.py, width: 1, type: "dashed", opacity: 0.7 }, areaStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
        { name: "Dia típico (60 pregões)", type: "line", data: tv.map((v, i) => (v == null || tc[i] == null ? null : +(v - tc[i]).toFixed(2))), stack: "tip", stackStrategy: "all", symbol: "none", lineStyle: { color: COR.magenta, width: 1, type: "dashed", opacity: 0.7 }, areaStyle: { color: COR.faixa },
          itemStyle: { color: "rgba(234,242,236,.4)" }, silent: true, tooltip: { show: false } },
        linha("Compra hoje", doDia("compra"), COR.py, Object.assign({ showSymbol: true, connectNulls: false, lineStyle: { width: 2.5, color: COR.py },
          markLine: mv ? { silent: true, symbol: "none", data: [{ xAxis: mv.h }], lineStyle: { color: COR.tinta, width: 1.2, type: "dashed" }, label: { formatter: "melhor hora para vender", color: COR.tinta, fontSize: r * 0.74, position: "insideEndTop", backgroundColor: "rgba(6,19,12,.55)", padding: [2, 4], borderRadius: 4 } } : undefined }, rotuloFim(g0, COR.py))),
        linha("Venda hoje", doDia("venda"), COR.magenta, Object.assign({ showSymbol: true, connectNulls: false, lineStyle: { width: 2.5, color: COR.magenta } }, rotuloFim(g0, COR.magenta))),
      ],
    }));

    // ---- força relativa, com as zonas coloridas
    const zona = (a, b, cor) => [{ yAxis: a, itemStyle: { color: cor } }, { yAxis: b }];
    const rotZona = { name: "_zonas", type: "scatter", symbolSize: 0, silent: true, tooltip: { show: false }, z: 1, data: [[0, 96, "Sobrecomprado · subiu rápido demais, costuma corrigir para baixo"], [0, 66, "Zona neutra · sem exagero"], [0, 26, "Sobrevendido · caiu rápido demais, costuma repicar para cima"]],
      label: { show: true, position: "right", distance: r * 0.3, formatter: (q) => q.value[2], color: COR.t2, fontSize: r * 0.72, verticalAlign: "top" } };
    desenhar("g-cambio-ifr", base({
      grid: { left: r * 0.4, right: r * 3.2, top: r * 0.8, bottom: r * 0.3, containLabel: true }, legend: { show: false },
      xAxis: eixoX({ type: "category", data: datas, boundaryGap: false, axisLabel: { color: COR.t3, fontSize: r * 0.76, hideOverlap: true, interval: Math.max(0, Math.floor(n / 6) - 1) } }),
      yAxis: eixoY(g0, { scale: false, min: 0, max: 100, interval: 10, axisLabel: { color: COR.t3, fontSize: r * 0.76, formatter: (v) => (v === 30 || v === 50 || v === 70 || v === 0 || v === 100 ? v : "") }, splitLine: { show: false } }),
      tooltip: Object.assign(base().tooltip, { formatter: (ps) => { ps = ps.filter((q) => q.seriesName === "IFR 14"); if (!ps.length) return ""; const v = ps[0].value; return "<b>" + F.dia(X.dias[ps[0].dataIndex].d) + "</b><br>IFR 14: " + (v == null ? "–" : F.n(v, 0) + (v >= 70 ? " · sobrecomprado" : v <= 30 ? " · sobrevendido" : " · zona neutra")); } }),
      series: [linha("IFR 14", X.ifr.map((v) => (v == null ? null : +v.toFixed(1))), COR.tinta, Object.assign({ connectNulls: false, lineStyle: { width: 2.2, color: COR.tinta },
        markLine: { silent: true, symbol: "none", data: [{ yAxis: 70 }, { yAxis: 30 }], lineStyle: { color: COR.t3, type: "dashed", width: 1 }, label: { show: false } },
        markArea: { silent: true, label: { show: false }, data: [zona(70, 100, "rgba(220,60,61,.22)"), zona(30, 70, "rgba(234,242,236,.05)"), zona(0, 30, "rgba(10,172,35,.2)")] } }, rotuloFim(g0, COR.tinta))), rotZona],
    }));

    // ---- leitura técnica: níveis, projeção e últimos picos e vales
    const ult4 = X.pv.slice(-4), dist = (nivel) => (nivel ? F.pct(nivel / u.medio - 1, 1, true) : "–");
    const linhasPv = ult4.map((q, k) => { const ant = k > 0 ? ult4[k - 1] : X.pv[X.pv.length - ult4.length - 1];
      return "<tr><th>" + (q.tipo === "pico" ? '<i class="tri pico"></i>Pico' : '<i class="tri vale"></i>Vale') + (q.confirmado ? "" : " <span class='apagado'>(em formação)</span>") + "</th><td>" + dm(X.dias[q.i].d) + "</td><td>" + g0(q.v) +
        "</td><td>" + (ant ? F.pct(q.v / ant.v - 1, 1, true) : "–") + "</td><td>" + (ant ? q.i - ant.i : "–") + "</td></tr>"; }).reverse().join("");
    const linProj = (rot, q) => (q ? "<tr><th>" + rot + " <span class='apagado'>· " + dm(q.d) + "</span></th><td>" + g0(q.med) + "</td><td>" + g0(q.i50) + " a " + g0(q.s50) + "</td><td>" + g0(q.i80) + " a " + g0(q.s80) + "</td></tr>" : "");
    document.getElementById("tecnica-cambio").innerHTML =
      (P.length ? '<table class="conta"><thead><tr><th>Projeção</th><th>Mediana</th><th>50% de confiança</th><th>80% de confiança</th></tr></thead><tbody>' + linProj("Em 30 dias", p30) + linProj("Em 60 dias", p60) + "</tbody></table>" : "") +
      '<table class="conta premissas"><thead><tr><th>Níveis de hoje</th><th></th></tr></thead><tbody>' +
      "<tr><th>Resistência (último pico confirmado)</th><td>" + g0(X.resistencia) + " <span class='apagado'>" + dist(X.resistencia) + "</span></td></tr>" +
      "<tr><th>Suporte (último vale confirmado)</th><td>" + g0(X.suporte) + " <span class='apagado'>" + dist(X.suporte) + "</span></td></tr>" +
      "<tr><th>Média de 10 · média de 50</th><td>" + g0(X.m10[n - 1]) + " · " + g0(X.m50[n - 1]) + "</td></tr>" +
      "<tr><th>Variação em 20 e em 60 pregões</th><td>" + F.pct(X.mom20, 1, true) + " · " + F.pct(X.mom60, 1, true) + "</td></tr>" +
      "<tr><th>Máxima e mínima desde " + dm(X.dias[0].d) + "</th><td>" + g0(X.max) + " · " + g0(X.min) + "</td></tr>" +
      "</tbody></table>" +
      '<table class="conta premissas"><thead><tr><th>Picos e vales</th><th>Data</th><th>Gs/US$</th><th>Variação</th><th>Pregões</th></tr></thead><tbody>' + linhasPv + "</tbody></table>" +
      '<p class="nota-conta">' + (X.proj ? "Projeção estatística, não promessa: parte do último fechamento, leva a tendência recente (" + F.pct(X.proj.tendDia, 2, true) + " ao dia, que perde força a cada 10 pregões) e abre o leque pela oscilação diária dos últimos 60 pregões (" + F.pct(X.proj.volDia, 2) + "). " : "") +
      "No estudo deste par, quem funcionou foram a tendência (médias) e o horário da conversão; os osciladores, como o IFR, não deram resultado.</p>";
  }

  // ================================================================== notícias (faixa na tela de câmbio)
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function haQuanto(iso) { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? "há " + m + " min" : m < 1440 ? "há " + Math.round(m / 60) + " h" : "há " + Math.round(m / 1440) + " d"; }
  function noticias(M) {
    const el = document.getElementById("noticias-cambio"); if (!el) return;
    // um pouco de cada praça (Paraguai, EUA, Brasil), as mais recentes de cada, depois em ordem de hora
    const COTA = { Paraguai: 8, EUA: 6, Brasil: 4 }, SIGLA = { Paraguai: "PY", EUA: "EUA", Brasil: "BR" }, usados = {};
    const itens = (M.noticias || []).filter((n) => { const r = n.regiao || ""; usados[r] = (usados[r] || 0) + 1; return usados[r] <= (COTA[r] || 4); })
      .sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, 18);
    if (!itens.length) { el.hidden = true; return; }
    const html = itens.map((n) => '<a class="nt" href="' + esc(n.url) + '" target="_blank" rel="noopener"><b class="tag t-' + esc((n.temas || [])[0] || "").normalize("NFD").replace(/[^a-z]/gi, "").toLowerCase() + '">' + esc([SIGLA[n.regiao]].concat(n.temas || []).filter(Boolean).join(" · ")) + "</b>" +
      "<time>" + haQuanto(n.quando) + "</time>" + esc(n.t) + (n.fonte ? '<span class="fonte"> · ' + esc(n.fonte) + "</span>" : "") + "</a>").join("");
    el.hidden = false;
    el.innerHTML = '<span class="nt-rot">Notícias</span><div class="nt-janela"><div class="nt-trilho" style="--dur:' + Math.max(60, itens.length * 9) + 's">' + html + html + "</div></div>";
  }

  // ================================================================== cotações do cabeçalho
  const tkAntes = {};
  /** Faixa de cotações do topo: verde ou vermelho pelo acumulado do dia; pisca quando o número muda. */
  function cotacoes(M) {
    const el = document.getElementById("cotacoes"); if (!el || !M.tk) return;
    el.innerHTML = M.tk.map((t) => { const dir = t.var == null || Math.abs(t.var) < 5e-5 ? "" : t.var > 0 ? " sobe" : " desce";
      return '<span class="tk' + dir + (t.vivo ? " vivo" : "") + (t.opc ? " opc" : "") + '" data-id="' + t.id + '" title="' + t.dica + '">' + (t.vivo ? '<i class="luz-viva"></i>' : "") + "<em>" + t.rot + "</em><b>" + F.n(t.val, t.dec) +
        (t.val2 != null ? "<s>·</s>" + F.n(t.val2, t.dec) : "") + "</b>" + (t.var != null ? '<span class="var">' + (t.var > 0 ? "▲" : t.var < 0 ? "▼" : "•") + " " + F.pct(Math.abs(t.var), Math.abs(t.var) < 0.001 ? 2 : 1) + "</span>" : "") + "</span>"; }).join("");
    M.tk.forEach((t) => { const a = tkAntes[t.id]; tkAntes[t.id] = t.val;
      if (a != null && a !== t.val) { const q = el.querySelector('[data-id="' + t.id + '"]'); if (q) q.classList.add(t.val > a ? "piscou-alta" : "piscou-baixa"); } });
    caberCotacoes();
  }
  /** Se a faixa não couber no cabeçalho, esconde primeiro as cotações secundárias. */
  function caberCotacoes() {
    const el = document.getElementById("cotacoes"); if (!el) return;
    const opc = [...el.querySelectorAll(".tk.opc")]; opc.forEach((q) => (q.hidden = false));
    if (matchMedia("(max-width: 1100px)").matches) return;
    while (el.scrollWidth > el.clientWidth + 1 && opc.length) opc.pop().hidden = true;
  }
  /** Clarão nos números do câmbio quando chega um corte novo. */
  function piscar(subiu) {
    document.querySelectorAll("#kpis-cambio .kpi.destaque").forEach((el) => { el.classList.remove("piscou-alta", "piscou-baixa"); void el.offsetWidth; el.classList.add(subiu ? "piscou-alta" : "piscou-baixa"); });
  }

  // ------------------------------------------------------------------ controles dentro dos cartões
  document.getElementById("alt-lucro").addEventListener("click", (e) => { const bt = e.target.closest("button[data-modo]"); if (!bt) return; lucroModo = bt.dataset.modo; lembra.gravar("mb:lucroModo", lucroModo); if (ultimoM) telaLucro(ultimoM); });
  document.getElementById("alt-oper").addEventListener("click", (e) => { const bt = e.target.closest("button[data-modo]"); if (!bt) return; operModo = bt.dataset.modo; lembra.gravar("mb:operModo", operModo); if (ultimoM) telaLucro(ultimoM); });
  document.getElementById("bt-hoje").addEventListener("click", () => { mesFixo = null; if (ultimoM) telaLucro(ultimoM); });

  window.Telas = { F, COR, telaGordo, telaReposicao, telaLucro, telaCambio, cotacoes, caberCotacoes, piscar, reanimar, redimensionar, contar, soltarMes };
})();

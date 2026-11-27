/* Mercado do Boi — transforma os dados lidos (Dados) + configurações (S) no modelo que as telas desenham. */
(function () {
  "use strict";
  const C = window.Calc;
  const entre = (v, a, b) => v != null && isFinite(v) && v >= a && v <= b;
  const hojeISO = () => { const t = new Date(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };
  const interp = (curva, venc) => { // curva [{venc, preco}] ordenada; interpola por data, pontas repetem
    if (!curva.length) return null;
    if (venc <= curva[0].venc) return curva[0].preco;
    for (let i = 1; i < curva.length; i++) if (venc <= curva[i].venc) {
      const a = curva[i - 1], b = curva[i], f = C.difDias(a.venc, venc) / Math.max(1, C.difDias(a.venc, b.venc));
      return a.preco + f * (b.preco - a.preco);
    }
    return curva[curva.length - 1].preco;
  };

  /** Hora de Assunção agora: {d: "aaaa-mm-dd", min: minutos desde 0h, util: seg a sex}. */
  function agoraAssuncao() {
    const p = {}; new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" })
      .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
    return { d: p.year + "-" + p.month + "-" + p.day, min: (+p.hour % 24) * 60 + +p.minute, util: ["Sat", "Sun"].indexOf(p.weekday) < 0 };
  }
  /** Pregão da B3 (boi e milho): dias úteis, das 9h às 18h30 de Brasília. */
  function b3Aberta() {
    const p = {}; new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
    const min = (+p.hour % 24) * 60 + +p.minute; return ["Sat", "Sun"].indexOf(p.weekday) < 0 && min >= 9 * 60 && min <= 18 * 60 + 30;
  }
  const mercadoAberto = () => { const a = agoraAssuncao(); return a.util && a.min >= 8 * 60 + 25 && a.min <= 13 * 60 + 40; };

  /** Câmbio BCP: velas diárias, médias, IFR, picos e vales, spread por horário. */
  function cambio(linhas, S) {
    if (!linhas || !linhas.length) return null;
    const porDia = new Map();
    for (const l of linhas) { l.medio = (l.compra + l.venda) / 2; l.spread = ((l.venda - l.compra) / l.medio) * 1e4; if (!porDia.has(l.d)) porDia.set(l.d, []); porDia.get(l.d).push(l); }
    const dias = [];
    for (const [d, cs] of porDia) {
      const reais = cs.filter((c) => !c.semNeg); if (!reais.length) continue;
      const m = reais.map((c) => c.medio), u = reais[reais.length - 1];
      dias.push({ d, o: m[0], h: Math.max.apply(null, m), l: Math.min.apply(null, m), c: m[m.length - 1], compra: u.compra, venda: u.venda,
        ref: u.compraAc > 0 && u.vendaAc > 0 ? (u.compraAc + u.vendaAc) / 2 : m[m.length - 1], cortes: cs });
    }
    if (!dias.length) return null;
    const fech = dias.map((x) => x.c), n = fech.length;
    const m10 = C.mms(fech, 10), m50 = C.mms(fech, 50), ifr = C.ifr(fech, 14), pv = C.picosVales(fech, S.limiarPivo || 0.02);
    let sinal = null, desde = null;
    if (m10[n - 1] != null && m50[n - 1] != null) {
      sinal = m10[n - 1] >= m50[n - 1] ? "alta" : "baixa";
      for (let i = n - 1; i >= 0 && m50[i] != null; i--) { if ((m10[i] >= m50[i] ? "alta" : "baixa") !== sinal) break; desde = dias[i].d; }
    }
    const hoje = dias[n - 1], ontem = n > 1 ? dias[n - 2] : null, reaisHoje = hoje.cortes.filter((c) => !c.semNeg), ult = reaisHoje[reaisHoje.length - 1];
    // spread mediano por horário nos últimos 60 pregões
    const janela = dias.slice(-60), horas = {};
    for (const x of janela) for (const c of x.cortes) if (!c.semNeg) (horas[c.h] = horas[c.h] || []).push(c.spread);
    const spreadHora = Object.keys(horas).sort().map((h) => ({ h, med: C.mediana(horas[h]), n: horas[h].length }));
    const melhor = spreadHora.length ? spreadHora.reduce((a, b) => (b.med < a.med ? b : a)) : null;
    const conf = pv.filter((x) => x.confirmado), ultPico = conf.filter((x) => x.tipo === "pico").pop(), ultVale = conf.filter((x) => x.tipo === "vale").pop();
    const ag = agoraAssuncao();
    // o dia típico: compra e venda de cada corte contra o preço médio do próprio dia (bps), mediana de 60 pregões
    const desv = (x) => { const reais = x.cortes.filter((c) => !c.semNeg), mm = C.media(reais.map((c) => c.medio)); return reais.map((c) => ({ h: c.h, co: (c.compra / mm - 1) * 1e4, ve: (c.venda / mm - 1) * 1e4 })); };
    const acc = {}; for (const x of janela) for (const c of desv(x)) { (acc[c.h] = acc[c.h] || { co: [], ve: [] }).co.push(c.co); acc[c.h].ve.push(c.ve); }
    const tipico = Object.keys(acc).sort().map((h) => ({ h, compra: C.mediana(acc[h].co), venda: C.mediana(acc[h].ve), n: acc[h].co.length }));
    tipico.forEach((t) => { t.spread = t.venda - t.compra; });
    const diaHoje = desv(hoje);
    const melhorVenda = tipico.length ? tipico.reduce((a, b) => (b.compra > a.compra ? b : a)) : null;   // quem vende dólar recebe a cotação de compra
    const melhorCompra = tipico.length ? tipico.reduce((a, b) => (b.venda < a.venda ? b : a)) : null;    // quem compra dólar paga a cotação de venda
    // métodos de análise técnica → nota de −2 (forte queda do dólar) a +2 (forte alta)
    const faixa = (v, f, m) => (v == null ? null : v >= f ? 2 : v >= m ? 1 : v <= -f ? -2 : v <= -m ? -1 : 0);
    const mc = C.macd(fech), bb = C.bollinger(fech, 20, 2), ifrU = ifr[n - 1], u = fech[n - 1];
    const gap = m10[n - 1] != null && m50[n - 1] != null ? m10[n - 1] / m50[n - 1] - 1 : null;
    const mom20 = n > 20 ? u / fech[n - 21] - 1 : null, mom60 = n > 60 ? u / fech[n - 61] - 1 : null;
    const picos = conf.filter((x) => x.tipo === "pico").slice(-2), vales = conf.filter((x) => x.tipo === "vale").slice(-2);
    let estr = null, estrTxt = "poucos pontos";
    if (ultPico && ultVale) {
      if (u > ultPico.v) { estr = 2; estrTxt = "rompeu a resistência de " + Math.round(ultPico.v); }
      else if (u < ultVale.v) { estr = -2; estrTxt = "perdeu o suporte de " + Math.round(ultVale.v); }
      else if (picos.length === 2 && vales.length === 2) {
        const sobe = picos[1].v > picos[0].v && vales[1].v > vales[0].v, desce = picos[1].v < picos[0].v && vales[1].v < vales[0].v;
        estr = sobe ? 1 : desce ? -1 : 0; estrTxt = sobe ? "topos e fundos ascendentes" : desce ? "topos e fundos descendentes" : "entre o suporte e a resistência";
      } else { estr = 0; estrTxt = "entre o suporte e a resistência"; }
    }
    const pc = (v) => (v == null ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(1).replace(".", ",") + "%");
    const metodos = [
      { nome: "Médias de 10 e 50 dias", tipo: "tendência", nota: faixa(gap, 0.015, 0.002), det: gap == null ? "faltam dias" : "média curta " + pc(gap) + " sobre a longa" },
      { nome: "Variação de 20 pregões", tipo: "tendência", nota: faixa(mom20, 0.03, 0.01), det: pc(mom20) },
      { nome: "Variação de 60 pregões", tipo: "tendência", nota: faixa(mom60, 0.06, 0.02), det: pc(mom60) },
      { nome: "MACD (12, 26, 9)", tipo: "tendência", nota: n < 35 ? null : (mc.hist[n - 1] > 0 ? (mc.macd[n - 1] > 0 ? 2 : 1) : mc.hist[n - 1] < 0 ? (mc.macd[n - 1] < 0 ? -2 : -1) : 0),
        det: n < 35 ? "faltam dias" : "histograma " + (mc.hist[n - 1] > 0 ? "positivo" : "negativo") + ", linha " + (mc.macd[n - 1] > 0 ? "acima" : "abaixo") + " de zero" },
      { nome: "Picos e vales", tipo: "tendência", nota: estr, det: estrTxt },
      { nome: "IFR de 14 dias", tipo: "oscilador", nota: ifrU == null ? null : ifrU >= 80 ? -2 : ifrU >= 70 ? -1 : ifrU <= 20 ? 2 : ifrU <= 30 ? 1 : 0,
        det: ifrU == null ? "faltam dias" : Math.round(ifrU) + (ifrU >= 70 ? ": sobrecomprado" : ifrU <= 30 ? ": sobrevendido" : ": zona neutra") },
      { nome: "Bandas de Bollinger (20, 2)", tipo: "oscilador", nota: !bb ? null : bb.pctB >= 1 ? -2 : bb.pctB >= 0.85 ? -1 : bb.pctB <= 0 ? 2 : bb.pctB <= 0.15 ? 1 : 0,
        det: !bb ? "faltam dias" : bb.pctB >= 0.85 ? "encostado na banda de cima" : bb.pctB <= 0.15 ? "encostado na banda de baixo" : "no meio das bandas" },
    ];
    const validos = metodos.filter((m) => m.nota != null), tend = validos.filter((m) => m.tipo === "tendência");
    const sintese = validos.length ? C.media(validos.map((m) => m.nota)) : null, sinteseTend = tend.length ? C.media(tend.map((m) => m.nota)) : null;
    // projeção: 42 pregões (≈ 60 dias corridos); o 21º pregão ≈ 30 dias
    const proj = C.projetar(fech, 42);
    if (proj) { let d = hoje.d; proj.pontos.forEach((pt) => { do { d = C.somaDias(d, 1); } while ([0, 6].indexOf(new Date(d + "T12:00:00Z").getUTCDay()) >= 0); pt.d = d; }); }
    return { dias, fech, m10, m50, ifr, pv, sinal, desde, hoje, ontem, ult, ref: hoje.ref, varDia: ontem ? ult.medio / ontem.c - 1 : null,
      mom60: n > 60 ? fech[n - 1] / fech[n - 61] - 1 : null, mom20: n > 20 ? fech[n - 1] / fech[n - 21] - 1 : null, spreadHora, melhor,
      spread30: C.mediana([].concat.apply([], dias.slice(-30).map((x) => x.cortes.filter((c) => !c.semNeg).map((c) => c.spread)))),
      resistencia: ultPico ? ultPico.v : null, suporte: ultVale ? ultVale.v : null, max: Math.max.apply(null, dias.map((x) => x.h)), min: Math.min.apply(null, dias.map((x) => x.l)),
      tipico, diaHoje, melhorVenda, melhorCompra, metodos, sintese, sinteseTend, proj, bb,
      aberto: mercadoAberto() && hoje.d === ag.d, chave: hoje.d + " " + ult.h + " " + ult.compra + " " + ult.venda };
  }

  function montar(D, S) {
    const M = { hoje: hojeISO(), S };
    const mesAtual = C.mesDe(M.hoje);
    const inicioJanela = (C.anoDe(M.hoje) - S.anos) + M.hoje.slice(4);

    // ================================================================ câmbio
    const fxMapa = new Map();
    for (const l of D.lotes) if (entre(l.cot, 4000, 9500)) fxMapa.set(l.d, l.cot);
    for (const c of D.yp.compras) if (entre(c.cambio, 4000, 9500)) fxMapa.set(c.d, c.cambio);
    D.fx.histPyg.d.forEach((d, i) => fxMapa.set(d, D.fx.histPyg.v[i]));
    // câmbio do BCP (referencial do mercado flutuante): quando existe, é ele que vale no painel inteiro
    M.cambio = cambio(D.yp.cambioBcp, S);
    if (M.cambio) M.cambio.dias.forEach((x) => fxMapa.set(x.d, x.ref));
    const fxD = [...fxMapa.keys()].sort(), fxV = fxD.map((d) => fxMapa.get(d));
    const pygHoje = (M.cambio && M.cambio.ref) || D.fx.pyg || (fxV.length ? fxV[fxV.length - 1] : null);
    const pygEm = fxD.length ? C.ultimoAte(fxD, fxV) : () => pygHoje;
    const brlHoje = D.fx.brl || (D.b3.dol[0] && D.b3.dol[0].preco) || null;
    const brlEm = (venc) => (D.b3.dol.length ? interp(D.b3.dol, venc) : brlHoje);
    M.fx = { pyg: pygHoje, brl: brlHoje, pygEm, fontePyg: M.cambio ? "BCP" : "mercado" };

    // ================================================================ boi gordo
    const anc = D.anc.boi, va = D.gordo;
    // Brasil: série âncora (US$/kg carcaça) + Indicador do Boi DATAGRO guardado dia a dia + o de hoje (R$/@ ÷ 15 ÷ dólar)
    const brMapa = new Map(); anc.d.forEach((d, i) => brMapa.set(d, anc.br[i]));
    const ptsBr = ((D.br && D.br.pontos) || []).slice();
    const brHoje = D.br && D.br.hoje;
    if (brHoje && !ptsBr.some((x) => x.d === brHoje.d)) ptsBr.push({ d: brHoje.d, rs: brHoje.rs, brl: null });
    const fxBr = (x) => x.brl > 3 ? x.brl : (D.fx.brl || null);
    ptsBr.forEach((x) => { const f = fxBr(x); if (f && x.d > (anc.d[anc.d.length - 1] || "")) brMapa.set(x.d, x.rs / 15 / f); });
    const brD = [...brMapa.keys()].sort(), brV = brD.map((d) => brMapa.get(d));
    const pyD = [], pyV = [];
    const corteVA = va.length ? va[0].d : "9999";
    anc.d.forEach((d, i) => { if (d < corteVA) { pyD.push(d); pyV.push(anc.py[i]); } });
    va.forEach((l) => { pyD.push(l.d); pyV.push(l.nov); });
    const pyEm = C.ultimoAte(pyD, pyV);
    // depois do fim da âncora, o basis diário sai do Valor Agro contra o DATAGRO do mesmo dia
    const basisNovo = brD.filter((d) => d > (anc.d[anc.d.length - 1] || "") && va.length && d >= va[0].d).map((d) => ({ d, b: pyEm(d) / brMapa.get(d) - 1 }));
    const ult = va.length ? va[va.length - 1] : null;
    const pyHoje = ult ? ult.nov : pyV[pyV.length - 1];
    let pySemana = null;
    if (va.length) { const alvo = C.somaDias(ult.d, -7); pySemana = C.ultimoAte(va.map((l) => l.d), va.map((l) => l.nov))(alvo); }

    // nossas vendas (confinamento): preço médio mensal ponderado por cabeças
    const vendasToro = D.yp.vendas.filter((v) => /TORO|NOVILLO|MACHO/.test(v.cat) || !v.cat);
    const vendasPreco = vendasToro.filter((v) => entre(v.preco, 1.5, 12) && (S.lotesPreco === "todos" || v.rural));
    const vendaMes = C.porMes(vendasPreco.map((v) => ({ d: v.d, v: v.preco, w: v.cab })));
    const corte45 = C.somaDias(M.hoje, -45);
    const rec = vendasPreco.filter((v) => v.d >= corte45);
    let vendaHoje = rec.length ? C.mediaPond(rec.map((v) => v.preco), rec.map((v) => v.cab)) : null, vendaRef = rec.length ? "45 dias" : null;
    if (vendaHoje == null && vendaMes.size) { const k = [...vendaMes.keys()].sort().pop(); vendaHoje = vendaMes.get(k); vendaRef = "média de " + k; }
    const cabRec = rec.reduce((s, v) => s + v.cab, 0);
    const porPreco = {}; rec.forEach((v) => { const k = v.preco.toFixed(2); porPreco[k] = (porPreco[k] || 0) + v.cab; });
    const ultVenda = rec.length ? rec[rec.length - 1] : null;
    const vendaDet = rec.length ? { min: Math.min.apply(null, rec.map((v) => v.preco)), max: Math.max.apply(null, rec.map((v) => v.preco)), ultPreco: ultVenda.preco, ultData: ultVenda.d,
      porPreco: Object.keys(porPreco).sort().map((k) => ({ preco: +k, cab: porPreco[k] })) } : null;

    // basis Paraguai × Brasil (% sobre o Brasil), sazonal
    const basisBoi = anc.d.map((d, i) => ({ d, b: anc.py[i] / anc.br[i] - 1 })).concat(basisNovo);
    const sazBoi = C.basisSazonal(basisBoi, S.qmin, S.qmax, S.basisAnosBoi, M.hoje);
    const anoCorr = String(C.anoDe(M.hoje));
    const basisAno = C.porMes(basisBoi.filter((l) => l.d.slice(0, 4) === anoCorr).map((l) => ({ d: l.d, v: l.b })));

    // curva BGI em US$/kg carcaça e equivalente Paraguai
    const curvaBoi = D.b3.bgi.filter((c) => c.venc >= M.hoje.slice(0, 8) + "01").slice(0, 12).map((c) => {
      const fx = brlEm(c.venc), usd = fx ? c.preco / 15 / fx : null, s = sazBoi[+c.venc.slice(5, 7) - 1];
      return { cod: c.cod, venc: c.venc, reais: c.preco, fx, usd, aberto: c.aberto, liquido: c.ultimo != null,
        pyMin: usd && s.qmin != null ? usd * (1 + s.qmin) : null, pyMed: usd && s.med != null ? usd * (1 + s.med) : null, pyMax: usd && s.qmax != null ? usd * (1 + s.qmax) : null,
        bMin: s.qmin, bMed: s.med, bMax: s.qmax };
    });
    const frenteBoi = curvaBoi[0] || null;
    const basisHoje = frenteBoi && frenteBoi.usd && pyHoje ? pyHoje / frenteBoi.usd - 1 : null;
    if (basisHoje != null) basisAno.set(mesAtual, basisHoje);
    const brUlt = brD.length ? { d: brD[brD.length - 1], usd: brV[brV.length - 1] } : null;
    M.boi = { pyD, pyV, brD, brV, brUlt, brHoje, ancFim: anc.d[anc.d.length - 1], pyHoje, pySemana, ue: ult ? ult.ue : null, vaca: ult ? ult.vaca : null, dataVA: ult ? ult.d : null,
      vendaMes, vendaHoje, vendaRef, cabRec, vendaDet, premio: vendaHoje != null && pyHoje ? vendaHoje - pyHoje : null,
      saz: sazBoi, basisAno, basisHoje, curva: curvaBoi, frente: frenteBoi, inicioJanela };

    // ================================================================ milho
    const am = D.anc.milho;
    const basisMilho = am.d.map((d, i) => ({ d, b: am.basis[i] })).concat(am.cauda_d.map((d, i) => ({ d, b: am.cauda_basis[i] })));
    const sazMilho = C.basisSazonal(basisMilho, S.qmin, S.qmax, S.basisAnosMilho, M.hoje);
    const basisMilhoAno = C.porMes(basisMilho.filter((l) => l.d.slice(0, 4) === anoCorr).map((l) => ({ d: l.d, v: l.b })));
    const curvaMilho = D.b3.ccm.filter((c) => c.venc >= M.hoje.slice(0, 8) + "01").slice(0, 10).map((c) => {
      const fx = brlEm(c.venc), usd = fx ? (c.preco / 60 * 1000) / fx : null, s = sazMilho[+c.venc.slice(5, 7) - 1];
      return { cod: c.cod, venc: c.venc, reais: c.preco, fx, usd, liquido: c.ultimo != null,
        pyMin: usd != null && s.qmin != null ? usd + s.qmin : null, pyMed: usd != null && s.med != null ? usd + s.med : null, pyMax: usd != null && s.qmax != null ? usd + s.qmax : null,
        bMin: s.qmin, bMed: s.med, bMax: s.qmax };
    });
    const milhoMes = C.porMes(D.yp.milho.map((x) => ({ d: x.d, v: x.usd, w: x.t })));
    const corte60 = C.somaDias(M.hoje, -60);
    const mRec = D.yp.milho.filter((x) => x.d >= corte60);
    let milhoHoje = mRec.length ? C.mediaPond(mRec.map((x) => x.usd), mRec.map((x) => x.t)) : null, milhoRef = mRec.length ? "compras de 60 dias" : null;
    if (milhoHoje == null && milhoMes.size) { const k = [...milhoMes.keys()].sort().pop(); milhoHoje = milhoMes.get(k); milhoRef = "compras de " + window.Telas.F.mesAno(k + "-01"); }
    const frenteMilho = curvaMilho[0] || null;
    // Chicago: centavos de dólar por bushel → US$/t (1 t de milho = 39,368 bushels)
    const cme = (D.cme ? D.cme.contratos : []).filter((c) => c.venc >= M.hoje.slice(0, 8) + "01").slice(0, 8).map((c) => ({ cod: c.cod, venc: c.venc, cents: c.preco, usd: c.preco / 100 * 39.368,
      var: c.anterior > 0 ? c.preco / c.anterior - 1 : null }));
    M.milho = { d: am.d, py: am.py, b3: am.b3, saz: sazMilho, basisAno: basisMilhoAno, curva: curvaMilho, frente: frenteMilho, milhoMes, milhoHoje, milhoRef,
      tMes: mRec.reduce((s, x) => s + x.t, 0), contratos: D.yp.contratosMilho, cme, cmeAtualizado: D.cme ? D.cme.atualizado : null, basisNosso: milhoHoje != null && frenteMilho && frenteMilho.usd ? milhoHoje - frenteMilho.usd : null,
      ultimoBasis: basisMilho.length ? basisMilho[basisMilho.length - 1] : null, inicioJanela };

    // ================================================================ reposição
    const ind = D.ind, u = ind.length ? ind[ind.length - 1] : null;
    const ant = ind.length > 1 ? ind[ind.length - 2] : null;
    const agio = ind.map((r) => {
      const fx = pygEm(r.d), nov = pyEm(r.d), vivo = nov * S.rcVivo;
      return { d: r.d, a180: fx && vivo ? r.m180 / fx / vivo - 1 : null, a360: fx && vivo ? r.m360 / fx / vivo - 1 : null };
    });
    const indD = ind.map((r) => r.d), indEm = ind.length ? C.ultimoAte(indD, ind) : () => null;
    // base da comparação (ajustável): "vendedor" = preço por cabeça ÷ peso sem desbaste; "balanca" = ÷ peso de balança na chegada;
    // "posto" = custo total (animal + frete + comissão) ÷ peso de balança. IVA tirado do nosso preço e comissão somada ao leilão, se informados.
    const baseC = S.baseCompra || "vendedor", fIva = 1 + (+S.ivaCompras || 0), fCom = 1 + (+S.comissaoLeilao || 0);
    const compras = D.yp.compras.filter((c) => entre(c.peso, 60, 450) && entre(c.pkg, 4000, 45000) && (!c.dono || /RURAL/i.test(c.dono))).map((c) => {
      const temBal = entre(c.pesoFaz, 60, 450);
      const peso = baseC !== "vendedor" && temBal ? c.pesoFaz : c.peso;
      const pcab = (baseC === "posto" && c.custoFaz > 0 ? c.custoFaz : c.pcab) / fIva, pkg = pcab / peso;
      const r = indEm(c.d), cc = r ? (c.sexo === "Fêmea" ? r.cF : r.cM) : null;
      const fx = entre(c.cambio, 4000, 9500) ? c.cambio : pygEm(c.d), nov = pyEm(c.d);
      const ref = r ? C.precoKg(r.beta, cc, peso) * fCom : null;
      return Object.assign({}, c, { peso, pcab, pkg, pesoVend: c.peso, desvio: r && c.d >= indD[0] && ref ? Math.log(pkg / ref) : null, ref,
        agio: fx && nov ? pkg / fx / (nov * S.rcVivo) - 1 : null });
    }).filter((c) => entre(c.pkg, 4000, 45000));
    const corteCompras = C.somaDias(M.hoje, -S.diasCompras);
    const cRec = compras.filter((c) => c.d >= corteCompras && c.desvio != null);
    const desvioMes = C.porMes(compras.filter((c) => c.desvio != null).map((c) => ({ d: c.d, v: c.desvio, w: c.cab })));
    const cabMes = new Map(); compras.forEach((c) => cabMes.set(C.mesDe(c.d), (cabMes.get(C.mesDe(c.d)) || 0) + c.cab));
    const corteNuvem = C.somaDias(M.hoje, -7 * S.semanasNuvem);
    const c12 = compras.filter((c) => c.d >= C.somaDias(M.hoje, -365) && c.desvio != null && c.sexo === "Macho");
    const porFaixa = [["até 200 kg", (c) => c.peso < 200], ["200 a 260 kg", (c) => c.peso >= 200 && c.peso < 260], ["260 kg ou mais", (c) => c.peso >= 260]].map(([nome, f]) => {
      const a = c12.filter(f); return { nome, n: a.length, cab: a.reduce((t, c) => t + c.cab, 0), desvio: a.length ? C.mediaPond(a.map((c) => c.desvio), a.map((c) => c.cab)) : null }; });
    const nuvemM = D.lotes.filter((l) => l.d >= corteNuvem && entre(l.peso, 60, 450) && entre(l.pkg, 4000, 45000) && l.sexo === "Macho");
    const ajustePond = C.mqoPond(nuvemM.map((l) => l.peso), nuvemM.map((l) => l.pkg * l.peso), nuvemM.map((l) => (l.cab > 0 ? l.cab : 1)));
    // régua de 2º grau (forma alternativa) e o valor marginal do kg em 180 e 360 kg
    const regua2 = C.reguaQuad(D.lotes, ind, { desde: C.somaDias(inicioJanela, -7) });
    const quad = ind.filter((r) => regua2.has(r.d) && r.beta > 0).map((r) => { const g = regua2.get(r.d), q180 = C.pontoQuad(r.beta, g, 180), q360 = C.pontoQuad(r.beta, g, 360);
      return { d: r.d, g, b180: q180.b, b360: q360.b, p180: q180.p, p360: q360.p, rQ180: q180.razao, rQ360: q360.razao,
        rL180: r.cM > 0 ? 180 / (180 + r.cM) : null, rL360: r.cM > 0 ? 360 / (360 + r.cM) : null }; });
    M.repo = { ind, u, ant, agio, compras, quad, quadHoje: quad.length ? quad[quad.length - 1] : null, comprasRec: compras.filter((c) => c.d >= corteCompras),
      desvioRec: cRec.length ? C.mediaPond(cRec.map((c) => c.desvio), cRec.map((c) => c.cab)) : null, cabRec: cRec.reduce((s, c) => s + c.cab, 0), nRec: cRec.length,
      desvioMes, cabMes, nuvem: D.lotes.filter((l) => l.d >= corteNuvem && entre(l.peso, 60, 450) && entre(l.pkg, 4000, 45000) && (l.sexo === "Macho" || l.sexo === "Fêmea")),
      agioHoje: agio.length ? agio[agio.length - 1] : null, inicioJanela, porFaixa, ajustePond, baseCompra: baseC,
      negocios: D.lotes.filter((l) => l.d >= inicioJanela && l.sexo === "Macho" && entre(l.peso, 60, 450) && entre(l.pkg, 4000, 45000)) };

    // ================================================================ lucratividade (método da conta manual "Rentabilidade Histórica")
    // recria (com a RIP) a custo fixo por cabeça; confinamento com pesos, dias, diária, RC e preço reais do mês; transferência ao preço do toretón.
    const PY = C.mesclar(C.PADRAO_YPOTI, { custoRecria: +S.custoRecria > 0 ? +S.custoRecria : C.PADRAO_YPOTI.custoRecria, diasRecria: +S.diasRecria > 0 ? +S.diasRecria : C.PADRAO_YPOTI.diasRecria });
    const lotesInd = vendasToro.filter((v) => (S.lotesPreco === "todos" || v.rural) && entre(v.pesoIni, 200, 520) && entre(v.pesoFim, 300, 750));
    const mesesLotes = [...new Set(lotesInd.map((v) => C.mesDe(v.d)))].sort();
    const primeiro = mesesLotes.length ? mesesLotes[Math.max(0, mesesLotes.length - 72)] : (ind.length ? C.mesDe(ind[0].d) : mesAtual);
    const meses = C.mesesEntre(primeiro, mesAtual);
    const serieL = (campo, a, b) => C.preencher(meses, C.porMes(lotesInd.filter((v) => entre(v[campo], a, b)).map((v) => ({ d: v.d, v: v[campo], w: v.cab }))));
    const Z = { pe: serieL("pesoIni", 200, 520), ps: serieL("pesoFim", 300, 750), rc: serieL("rcFin", 0.48, 0.63), dias: serieL("dias", 40, 220), diaria: serieL("diaria", 1, 6) };
    // o que a operação do confinamento realmente custou e rendeu no mês (planilha de resultados), sem preencher meses vazios
    const real = (campo) => C.porMes(lotesInd.filter((v) => v[campo] > 0).map((v) => ({ d: v.d, v: v[campo], w: v.cab })));
    const realEnt = real("entrada"), realConf = real("custoConf"), realRec = real("receita");
    // preço da reposição: o que a Ypoti pagou (machos; desmamante < 200 kg, senão 200–250; toretón > 300 kg, senão 250–300) ou o indicador dos leilões
    const comprasM = D.yp.compras.filter((c) => c.sexo === "Macho" && (!c.dono || /RURAL/i.test(c.dono)) && entre(c.pkg, 4000, 45000) && entre(c.peso, 60, 450));
    const classe = (f) => C.porMes(comprasM.filter(f).map((c) => ({ d: c.d, v: c.pkg, w: c.cab })));
    const junta = (a, b) => { const m = new Map(b); a.forEach((v, k) => m.set(k, v)); return m; };
    const ypDesm = junta(classe((c) => c.peso < 200), classe((c) => c.peso >= 200 && c.peso < 250));
    const ypTor = junta(classe((c) => c.peso > 300), classe((c) => c.peso >= 250 && c.peso <= 300));
    const ffill = (mapa) => { let ult = null; const pri = [...mapa.keys()].sort()[0]; return meses.map((m) => { if (mapa.has(m)) ult = mapa.get(m); return ult != null ? ult : (pri ? mapa.get(pri) : null); }); };
    const usaYpoti = S.precoReposicao !== "leilao" && ypDesm.size > 0 && ypTor.size > 0;
    const desmM = usaYpoti ? ffill(ypDesm) : C.preencher(meses, C.porMes(ind.map((r) => ({ d: r.d, v: r.m180 })))).v;
    const torM = usaYpoti ? ffill(ypTor) : C.preencher(meses, C.porMes(ind.map((r) => ({ d: r.d, v: r.m360 })))).v;
    const fxM = C.preencher(meses, C.porMes(fxD.map((d, i) => ({ d, v: fxV[i] }))));
    const pyM = C.preencher(meses, C.porMes(pyD.map((d, i) => ({ d, v: pyV[i] }))));
    const vendaM = C.preencher(meses, vendaMes);
    const temVenda = vendaMes.size > 0;
    const serie = meses.map((m, i) => {
      const venda = temVenda && vendaM.v[i] != null ? vendaM.v[i] : (pyM.v[i] != null ? pyM.v[i] + S.premioSemDados : PY.venda);
      const p = C.mesclar(PY, { desmamante: desmM[i], toreton: torM[i], cambio: fxM.v[i], venda, pesoEntrada: Z.pe.v[i], pesoSaida: Z.ps.v[i], rc: Z.rc.v[i], dias: Z.dias.v[i], diaria: Z.diaria.v[i] });
      const r = C.lucroYpoti(p);
      return { mes: m, r, mercado: pyM.v[i], vendaEstimada: !temVenda || vendaM.est[i], zootEstimada: Z.pe.est[i],
        oper: { compra: realEnt.has(m) ? realEnt.get(m) : null, compraMercado: r.conf.compra, engorda: realConf.has(m) ? realConf.get(m) : null, receita: realRec.has(m) ? realRec.get(m) : null } };
    });
    // "hoje": preços mais recentes; zootecnia = média dos 3 últimos meses fechados com abate
    const fechados = mesesLotes.filter((m) => m < mesAtual).slice(-3);
    const l3 = lotesInd.filter((v) => fechados.indexOf(C.mesDe(v.d)) >= 0);
    const m3 = (campo, a, b) => { const x = l3.filter((v) => entre(v[campo], a, b)); return x.length ? C.mediaPond(x.map((v) => v[campo]), x.map((v) => v.cab)) : null; };
    const recentes = (f, dias) => { const x = comprasM.filter((c) => f(c) && c.d >= C.somaDias(M.hoje, -dias)); return x.length ? C.mediaPond(x.map((c) => c.pkg), x.map((c) => c.cab)) : null; };
    const desmHoje = usaYpoti ? (recentes((c) => c.peso < 200, 60) || recentes((c) => c.peso < 250, 60) || desmM[desmM.length - 1]) : (u ? u.m180 : null);
    const torHoje = usaYpoti ? (recentes((c) => c.peso > 300, 60) || recentes((c) => c.peso >= 250, 60) || torM[torM.length - 1]) : (u ? u.m360 : null);
    const vendaAtual = +S.vendaManual > 0 ? +S.vendaManual : vendaHoje != null ? vendaHoje : (pyHoje != null ? pyHoje + S.premioSemDados : PY.venda);
    const pHoje = C.mesclar(PY, { desmamante: desmHoje, toreton: torHoje, cambio: pygHoje, venda: vendaAtual,
      pesoEntrada: m3("pesoIni", 200, 520), pesoSaida: m3("pesoFim", 300, 750), rc: m3("rcFin", 0.48, 0.63), dias: m3("dias", 40, 220), diaria: m3("diaria", 1, 6) });
    const atual = C.lucroYpoti(pHoje);
    // sensibilidade: lucro do ciclo × preço do gordo × preço do desmamante
    const dv = [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6], db = [-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15];
    const sens = { dv, db, z: db.map((b) => dv.map((v) => C.lucroYpoti(C.mesclar(pHoje, { venda: pHoje.venda + v, desmamante: pHoje.desmamante * (1 + b) })).global.lucro)) };
    M.lucro = { serie: serie.slice(-60), atual, pHoje, PY, fechados, sens, temVenda, usaYpoti, nLotes: l3.reduce((t, v) => t + v.cab, 0),
      vendaRef: +S.vendaManual > 0 ? "informado nas configurações" : vendaHoje != null ? (rec.length ? "média ponderada das vendas dos últimos 45 dias" : vendaRef) : (pyHoje != null ? "Valor Agro (sem venda nossa)" : "padrão") };
    M.noticias = D.noticias ? D.noticias.itens : [];
    // ================================================================ cotações do topo (verde ou vermelho pelo acumulado do dia)
    const liq = (cs) => { const a = cs.filter((c) => c.ultimo != null); return a.length ? a.reduce((x, y) => ((y.aberto || 0) > (x.aberto || 0) ? y : x)) : (cs[0] || null); };
    const fb = liq(D.b3.bgi.filter((c) => c.venc >= M.hoje)), fm = liq(D.b3.ccm.filter((c) => c.venc >= M.hoje));
    const vaAnt = va.length > 1 ? (() => { for (let i = va.length - 2; i >= 0; i--) if (va[i].d < ult.d) return va[i].nov; return null; })() : null;
    M.tk = [
      { id: "boi", rot: "Boi PY", val: pyHoje, dec: 2, var: vaAnt ? pyHoje / vaAnt - 1 : null, dica: "Novillo Valor Agro, US$/kg carcaça; variação contra o dia anterior" },
      brHoje ? { id: "boisp", rot: "Boi SP", val: brHoje.rs, dec: 2, var: brHoje.var, dica: "Indicador do Boi DATAGRO SP, R$/@ à vista, " + brHoje.d.slice(8, 10) + "/" + brHoje.d.slice(5, 7) + "; variação contra o dia anterior", opc: true } : null,
      { id: "bez", rot: "Bezerro", val: u ? u.m180 : null, dec: 0, var: u && ant ? u.m180 / ant.m180 - 1 : null, dica: "Macho de 180 kg, Gs/kg vivo; variação contra a semana anterior", opc: true },
      { id: "bgi", rot: fb ? fb.cod : "BGI", val: fb ? fb.preco : null, dec: 2, var: fb && fb.ultimo && fb.ajuste ? fb.ultimo / fb.ajuste - 1 : null, vivo: b3Aberta() && fb && fb.ultimo != null, dica: "Boi gordo futuro na B3, R$/@; variação contra o ajuste de ontem" },
      { id: "ccm", rot: fm ? fm.cod : "CCM", val: fm ? fm.preco : null, dec: 2, var: fm && fm.ultimo && fm.ajuste ? fm.ultimo / fm.ajuste - 1 : null, vivo: b3Aberta() && fm && fm.ultimo != null, dica: "Milho futuro na B3, R$/saca; variação contra o ajuste de ontem" },
      M.milho.cme.length ? { id: "cme", rot: "CME " + M.milho.cme[0].cod.slice(2), val: M.milho.cme[0].cents, dec: 0, var: M.milho.cme[0].var, dica: "Milho em Chicago, centavos de dólar por bushel", opc: true } : null,
      M.cambio ? { id: "pyg", rot: "Gs/US$", val: M.cambio.ult.compra, val2: M.cambio.ult.venda, dec: 0, var: M.cambio.varDia, vivo: M.cambio.aberto, piscando: M.cambio.aberto, dica: "Câmbio BCP: compra · venda no corte das " + M.cambio.ult.h }
        : (pygHoje ? { id: "pyg", rot: "Gs/US$", val: pygHoje, dec: 0, var: null, dica: "Câmbio de mercado" } : null),
    ].filter((x) => x && x.val != null);
    return M;
  }

  window.Modelo = { montar, mercadoAberto, agoraAssuncao, b3Aberta };
})();

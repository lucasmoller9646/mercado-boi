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

  function montar(D, S) {
    const M = { hoje: hojeISO(), S };
    const mesAtual = C.mesDe(M.hoje);
    const inicioJanela = (C.anoDe(M.hoje) - S.anos) + M.hoje.slice(4);

    // ================================================================ câmbio
    const fxMapa = new Map();
    for (const l of D.lotes) if (entre(l.cot, 4000, 9500)) fxMapa.set(l.d, l.cot);
    for (const c of D.yp.compras) if (entre(c.cambio, 4000, 9500)) fxMapa.set(c.d, c.cambio);
    D.fx.histPyg.d.forEach((d, i) => fxMapa.set(d, D.fx.histPyg.v[i]));
    const fxD = [...fxMapa.keys()].sort(), fxV = fxD.map((d) => fxMapa.get(d));
    const pygHoje = D.fx.pyg || (fxV.length ? fxV[fxV.length - 1] : null);
    const pygEm = fxD.length ? C.ultimoAte(fxD, fxV) : () => pygHoje;
    const brlHoje = D.fx.brl || (D.b3.dol[0] && D.b3.dol[0].preco) || null;
    const brlEm = (venc) => (D.b3.dol.length ? interp(D.b3.dol, venc) : brlHoje);
    M.fx = { pyg: pygHoje, brl: brlHoje, pygEm };

    // ================================================================ boi gordo
    const anc = D.anc.boi, va = D.gordo;
    const pyD = [], pyV = [];
    const corteVA = va.length ? va[0].d : "9999";
    anc.d.forEach((d, i) => { if (d < corteVA) { pyD.push(d); pyV.push(anc.py[i]); } });
    va.forEach((l) => { pyD.push(l.d); pyV.push(l.nov); });
    const pyEm = C.ultimoAte(pyD, pyV);
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

    // basis Paraguai × Brasil (% sobre o Brasil), sazonal
    const basisBoi = anc.d.map((d, i) => ({ d, b: anc.py[i] / anc.br[i] - 1 }));
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
    M.boi = { pyD, pyV, brD: anc.d, brV: anc.br, pyHoje, pySemana, ue: ult ? ult.ue : null, vaca: ult ? ult.vaca : null, dataVA: ult ? ult.d : null,
      vendaMes, vendaHoje, vendaRef, cabRec, premio: vendaHoje != null && pyHoje ? vendaHoje - pyHoje : null,
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
    let milhoHoje = mRec.length ? C.mediaPond(mRec.map((x) => x.usd), mRec.map((x) => x.t)) : null, milhoRef = mRec.length ? "entregas de 60 dias" : null;
    if (milhoHoje == null && milhoMes.size) { const k = [...milhoMes.keys()].sort().pop(); milhoHoje = milhoMes.get(k); milhoRef = "entregas de " + k; }
    const frenteMilho = curvaMilho[0] || null;
    M.milho = { d: am.d, py: am.py, b3: am.b3, saz: sazMilho, basisAno: basisMilhoAno, curva: curvaMilho, frente: frenteMilho, milhoMes, milhoHoje, milhoRef,
      tMes: mRec.reduce((s, x) => s + x.t, 0), contratos: D.yp.contratosMilho, basisNosso: milhoHoje != null && frenteMilho && frenteMilho.usd ? milhoHoje - frenteMilho.usd : null,
      ultimoBasis: basisMilho.length ? basisMilho[basisMilho.length - 1] : null, inicioJanela };

    // ================================================================ reposição
    const ind = D.ind, u = ind.length ? ind[ind.length - 1] : null;
    const ant = ind.length > 1 ? ind[ind.length - 2] : null;
    const agio = ind.map((r) => {
      const fx = pygEm(r.d), nov = pyEm(r.d), vivo = nov * S.rcVivo;
      return { d: r.d, a180: fx && vivo ? r.m180 / fx / vivo - 1 : null, a360: fx && vivo ? r.m360 / fx / vivo - 1 : null };
    });
    const indD = ind.map((r) => r.d), indEm = ind.length ? C.ultimoAte(indD, ind) : () => null;
    const compras = D.yp.compras.filter((c) => entre(c.peso, 60, 450) && entre(c.pkg, 4000, 45000) && (!c.dono || /RURAL/i.test(c.dono))).map((c) => {
      const r = indEm(c.d), cc = r ? (c.sexo === "Fêmea" ? r.cF : r.cM) : null;
      const fx = entre(c.cambio, 4000, 9500) ? c.cambio : pygEm(c.d), nov = pyEm(c.d);
      return Object.assign({}, c, { desvio: r && c.d >= indD[0] ? C.desvio(c.pkg, r.beta, cc, c.peso) : null, ref: r ? C.precoKg(r.beta, cc, c.peso) : null,
        agio: fx && nov ? c.pkg / fx / (nov * S.rcVivo) - 1 : null });
    });
    const corteCompras = C.somaDias(M.hoje, -S.diasCompras);
    const cRec = compras.filter((c) => c.d >= corteCompras && c.desvio != null);
    const desvioMes = C.porMes(compras.filter((c) => c.desvio != null).map((c) => ({ d: c.d, v: c.desvio, w: c.cab })));
    const cabMes = new Map(); compras.forEach((c) => cabMes.set(C.mesDe(c.d), (cabMes.get(C.mesDe(c.d)) || 0) + c.cab));
    const corteNuvem = C.somaDias(M.hoje, -7 * S.semanasNuvem);
    M.repo = { ind, u, ant, agio, compras, comprasRec: compras.filter((c) => c.d >= corteCompras),
      desvioRec: cRec.length ? C.mediaPond(cRec.map((c) => c.desvio), cRec.map((c) => c.cab)) : null, cabRec: cRec.reduce((s, c) => s + c.cab, 0), nRec: cRec.length,
      desvioMes, cabMes, nuvem: D.lotes.filter((l) => l.d >= corteNuvem && entre(l.peso, 60, 450) && entre(l.pkg, 4000, 45000) && (l.sexo === "Macho" || l.sexo === "Fêmea")),
      agioHoje: agio.length ? agio[agio.length - 1] : null, inicioJanela };

    // ================================================================ lucratividade
    const base = C.mesclar(C.PADRAO, S.params || {});
    const primeiro = ind.length ? C.mesDe(ind[0].d) : mesAtual;
    const meses = C.mesesEntre(primeiro, mesAtual);
    const desmM = C.preencher(meses, C.porMes(ind.map((r) => ({ d: r.d, v: r.m180 }))));
    const torM = C.preencher(meses, C.porMes(ind.map((r) => ({ d: r.d, v: r.m360 }))));
    const fxM = C.preencher(meses, C.porMes(fxD.map((d, i) => ({ d, v: fxV[i] }))));
    const pyM = C.preencher(meses, C.porMes(pyD.map((d, i) => ({ d, v: pyV[i] }))));
    const vendaM = C.preencher(meses, vendaMes);
    const temVenda = vendaMes.size > 0;
    const lotesInd = vendasToro.filter((v) => S.lotesPreco === "todos" || v.rural);
    const serieInd = (campo, a, b) => C.preencher(meses, C.porMes(lotesInd.filter((v) => entre(v[campo], a, b)).map((v) => ({ d: v.d, v: v[campo], w: v.cab }))));
    const usarReal = S.indicadores === "realizado" && lotesInd.length > 0;
    const I = usarReal ? { gmd: serieInd("gmd", 0.5, 2.6), rcFin: serieInd("rcFin", 0.48, 0.63), consumo: serieInd("cms", 5, 16), custoNutr: serieInd("custoNutr", 0.08, 0.7), gastosOp: serieInd("gastosOp", 0, 1.5) } : null;
    const serie = meses.map((m, i) => {
      const venda = temVenda && vendaM.v[i] != null ? vendaM.v[i] : (pyM.v[i] != null ? pyM.v[i] + S.premioSemDados : base.venda);
      const extra = { desmamante: desmM.v[i], toreton: torM.v[i], cambio: fxM.v[i], venda };
      if (I) extra.conf = { gmd: I.gmd.v[i], rcFin: I.rcFin.v[i], consumo: I.consumo.v[i], custoNutr: I.custoNutr.v[i], gastosOp: I.gastosOp.v[i] };
      return { mes: m, r: C.lucratividade(C.mesclar(base, extra)), mercado: pyM.v[i], vendaEstimada: !temVenda || vendaM.est[i], indEstimado: I ? I.gmd.est[i] : false };
    });
    // "hoje": preços mais recentes; indicadores = média dos 3 últimos meses fechados com abate
    const fechados = [...new Set(lotesInd.map((v) => C.mesDe(v.d)))].filter((m) => m < mesAtual).sort().slice(-3);
    const l3 = lotesInd.filter((v) => fechados.indexOf(C.mesDe(v.d)) >= 0);
    const m3 = (campo, a, b) => { const x = l3.filter((v) => entre(v[campo], a, b)); return x.length ? C.mediaPond(x.map((v) => v[campo]), x.map((v) => v.cab)) : null; };
    const indHoje = usarReal && l3.length ? { gmd: m3("gmd", 0.5, 2.6), rcFin: m3("rcFin", 0.48, 0.63), consumo: m3("cms", 5, 16), custoNutr: m3("custoNutr", 0.08, 0.7), gastosOp: m3("gastosOp", 0, 1.5) } : null;
    const vendaAtual = vendaHoje != null ? vendaHoje : (pyHoje != null ? pyHoje + S.premioSemDados : base.venda);
    const extraHoje = { desmamante: u ? u.m180 : null, toreton: u ? u.m360 : null, cambio: pygHoje, venda: vendaAtual };
    if (indHoje) extraHoje.conf = indHoje;
    const pHoje = C.mesclar(base, extraHoje);
    const atual = C.lucratividade(pHoje);
    // sensibilidade: lucro global × preço do gordo × preço do bezerro
    const dv = [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6], db = [-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15];
    const sens = { dv, db, z: db.map((b) => dv.map((v) => C.lucratividade(C.mesclar(pHoje, { venda: pHoje.venda + v, desmamante: pHoje.desmamante * (1 + b) })).global.lucro)) };
    M.lucro = { serie: serie.slice(-60), atual, pHoje, base, indHoje, fechados, sens, usarReal, temVenda, vendaRef: vendaHoje != null ? (rec.length ? "média ponderada das vendas dos últimos 45 dias" : vendaRef) : (pyHoje != null ? "Valor Agro (sem venda nossa)" : "planilha"),
      padrao: C.lucratividade(base) };
    return M;
  }

  window.Modelo = { montar };
})();

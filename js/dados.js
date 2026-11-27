/* Mercado do Boi — leitura das fontes. Cada função devolve dados já limpos; erros ficam em Dados.estado. */
(function () {
  "use strict";
  const C = window.Calc, CFG = window.MB_CONFIG;
  const estado = {}; // fonte → {estado: ok|atualizando|erro|desligado, quando, nota}
  const marca = (fonte, est, nota) => { estado[fonte] = { estado: est, quando: new Date(), nota: nota || "" }; };

  async function pegar(url, tipo, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 45000);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return tipo === "json" ? await r.json() : await r.text();
    } finally { clearTimeout(t); }
  }

  /** Planilha compartilhada por link, via gviz: devolve {rotulos, linhas} com valores tipados. */
  async function gviz(id, aba, opc) {
    opc = opc || {};
    let url = "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?tqx=out:json&sheet=" + encodeURIComponent(aba);
    if (opc.cabecalhos) url += "&headers=" + opc.cabecalhos;
    if (opc.consulta) url += "&tq=" + encodeURIComponent(opc.consulta);
    const txt = await pegar(url, "texto");
    const j = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    if (j.status !== "ok") throw new Error((j.errors && j.errors[0] && j.errors[0].detailed_message) || "consulta recusada");
    return { rotulos: j.table.cols.map((c) => c.label || ""), linhas: j.table.rows.map((r) => r.c.map((c) => (c ? c.v : null))) };
  }

  // ------------------------------------------------------------ séries embutidas (âncoras)
  async function ancoras() {
    const [boi, milho] = await Promise.all([pegar("data/boi_ancora.json", "json"), pegar("data/milho_ancora.json", "json")]);
    return { boi, milho };
  }

  // ------------------------------------------------------------ boi gordo (Valor Agro)
  async function gordo() {
    marca("gordo", "atualizando");
    try {
      const g = await gviz(CFG.planilhas.gordo.id, CFG.planilhas.gordo.aba, { cabecalhos: 1 });
      const col = (nome) => g.rotulos.indexOf(nome);
      const iD = col("date"), iN = col("ganado_a_frigorifico__novillo__semana_actual"), iNa = col("ganado_a_frigorifico__novillo__semana_anterior"),
        iU = col("ganado_a_frigorifico__novillo_ue__semana_actual"), iV = col("ganado_a_frigorifico__vaquilla__semana_actual"), iVa = col("ganado_a_frigorifico__vacas__semana_actual");
      if (iD < 0 || iN < 0) throw new Error("colunas da planilha Valor Agro mudaram");
      const porDia = new Map();
      for (const l of g.linhas) {
        const d = C.data(l[iD]), nov = C.num(l[iN]);
        if (!d || !(nov > 0)) continue;
        porDia.set(d, { d, nov, novAnt: C.num(l[iNa]), ue: iU >= 0 ? C.num(l[iU]) : null, vaq: iV >= 0 ? C.num(l[iV]) : null, vaca: iVa >= 0 ? C.num(l[iVa]) : null });
      }
      const linhas = [...porDia.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
      marca("gordo", "ok", linhas.length ? "até " + linhas[linhas.length - 1].d : "vazia");
      return linhas;
    } catch (e) { marca("gordo", "erro", String(e.message || e)); return []; }
  }

  // ------------------------------------------------------------ reposição (indicador semanal + lotes de leilão)
  async function indicador() {
    marca("reposicao", "atualizando");
    try {
      const g = await gviz(CFG.planilhas.reposicao.id, CFG.planilhas.reposicao.indicador, { cabecalhos: 2 });
      const linhas = [];
      for (const l of g.linhas) {
        const d = C.data(l[0]);
        if (!d || !(l[1] > 0)) continue;
        linhas.push({ d, m180: l[1], m230: l[2], m300: l[3], m360: l[4], f180: l[5], f230: l[6], f300: l[7], f360: l[8], lotes: l[9] || 0,
          origem: l[12], beta: l[13], aM: l[14], aF: l[15], cM: l[16], cF: l[17], r2: l[22], sit: l[24] });
      }
      linhas.sort((a, b) => (a.d < b.d ? -1 : 1));
      marca("reposicao", "ok", linhas.length ? "semana de " + linhas[linhas.length - 1].d : "vazia");
      return linhas;
    } catch (e) { marca("reposicao", "erro", String(e.message || e)); return []; }
  }

  async function lotes() {
    try {
      const g = await gviz(CFG.planilhas.reposicao.id, CFG.planilhas.reposicao.base, { cabecalhos: 1,
        consulta: "select B,D,J,K,N,O,R,S,Y where L='SIM' and Z='SIM' and O is not null and S is not null" });
      const out = [];
      for (const l of g.linhas) {
        const d = C.data(l[1]), peso = C.num(l[5]), pkg = C.num(l[7]);
        if (!d || !(peso > 0) || !(pkg > 0)) continue;
        out.push({ fonte: l[0], d, cat: l[2], sexo: l[3], cab: C.num(l[4]) || 0, peso, pcab: C.num(l[6]) || pkg * peso, pkg, cot: C.num(l[8]) });
      }
      out.sort((a, b) => (a.d < b.d ? -1 : 1));
      return out;
    } catch (e) { marca("reposicao", "erro", "lotes: " + String(e.message || e)); return []; }
  }

  // ------------------------------------------------------------ bolsa (B3): BGI, CCM e DOL
  async function b3() {
    marca("b3", "atualizando");
    const um = async (ativo) => {
      const j = await pegar(CFG.b3 + ativo, "json", 30000);
      const re = new RegExp("^" + ativo + "[FGHJKMNQUVXZ]\\d\\d$");
      const out = [];
      for (const s of j.Scty || []) {
        if (!re.test(s.symb) || !s.SctyQtn) continue;
        const q = s.SctyQtn, venc = s.asset && s.asset.AsstSummry && s.asset.AsstSummry.mtrtyCode;
        const ultimo = q.curPrc > 0 ? q.curPrc : null, ajuste = q.prvsDayAdjstmntPric > 0 ? q.prvsDayAdjstmntPric : null;
        if (!venc || !(ultimo || ajuste)) continue;
        out.push({ cod: s.symb, venc, preco: ultimo || ajuste, ultimo, ajuste, aberto: (s.asset.AsstSummry.opnCtrcts) || 0 });
      }
      out.sort((a, b) => (a.venc < b.venc ? -1 : 1));
      return { contratos: out, hora: j.Msg && j.Msg.dtTm };
    };
    try {
      const [bgi, ccm, dol] = await Promise.all([um("BGI"), um("CCM"), um("DOL")]);
      marca("b3", bgi.contratos.length ? "ok" : "erro", bgi.hora ? "cotação de " + bgi.hora : "");
      return { bgi: bgi.contratos, ccm: ccm.contratos, dol: dol.contratos.map((c) => Object.assign(c, { preco: c.preco / 1000 })), hora: bgi.hora };
    } catch (e) { marca("b3", "erro", String(e.message || e)); return { bgi: [], ccm: [], dol: [], hora: null }; }
  }

  // ------------------------------------------------------------ câmbio (à vista + histórico diário do guarani)
  async function cambio() {
    marca("cambio", "atualizando");
    const out = { brl: null, pyg: null, histPyg: { d: [], v: [] }, histBrl: { d: [], v: [] } };
    try {
      const j = await pegar(CFG.cambio + "last/USD-BRL,USD-PYG", "json", 20000);
      out.brl = C.num(j.USDBRL && j.USDBRL.bid); out.pyg = C.num(j.USDPYG && j.USDPYG.bid);
      const hist = async (par, n) => {
        const a = await pegar(CFG.cambio + "daily/" + par + "/" + n, "json", 30000);
        const m = new Map();
        for (const x of a) { const d = new Date(+x.timestamp * 1000).toISOString().slice(0, 10), v = C.num(x.bid); if (v > 0) m.set(d, v); }
        const d = [...m.keys()].sort();
        return { d, v: d.map((k) => m.get(k)) };
      };
      const [hp, hb] = await Promise.allSettled([hist("USD-PYG", 3000), hist("USD-BRL", 400)]);
      if (hp.status === "fulfilled") out.histPyg = hp.value;
      if (hb.status === "fulfilled") out.histBrl = hb.value;
      marca("cambio", out.brl ? "ok" : "erro", out.brl ? "R$ " + out.brl.toFixed(3).replace(".", ",") : "");
    } catch (e) { marca("cambio", "erro", String(e.message || e)); }
    return out;
  }

  // ------------------------------------------------------------ Ypoti (ponte Apps Script): compras, vendas e milho
  function tabela(f) {
    if (!f || f.erro || !f.cab) return null;
    const pos = {}; f.cab.forEach((c, i) => (pos[c] = i));
    return { linhas: f.linhas, c: (nome) => pos[nome] };
  }

  /** Câmbio BCP (cortes de 30 min): devolve [{d, h, compra, venda, compraAc, vendaAc, semNeg}] em ordem. */
  function lerCambio(f) {
    const t = tabela(f); if (!t) return [];
    const hora = (v) => { if (v == null) return null; if (typeof v === "number") { const m = Math.round(v * 1440); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
      const m = /(\d{1,2}):(\d{2})/.exec(String(v)); return m ? m[1].padStart(2, "0") + ":" + m[2] : null; };
    const out = [];
    for (const l of t.linhas) {
      const d = C.data(l[t.c("data")]), h = hora(l[t.c("hora_corte")]), compra = C.num(l[t.c("compra_corte")], "es"), venda = C.num(l[t.c("venda_corte")], "es");
      if (!d || !h || !(compra > 1000) || !(venda > 1000)) continue;
      out.push({ d, h, compra, venda, compraAc: C.num(l[t.c("compra_acumulado")], "es"), vendaAc: C.num(l[t.c("venda_acumulado")], "es"), semNeg: /^S/i.test(String(l[t.c("corte_sem_negocios")] || "")) });
    }
    out.sort((x, y) => (x.d + x.h < y.d + y.h ? -1 : 1));
    return out;
  }
  /** Só o câmbio (leve): usado na atualização rápida enquanto o mercado está aberto. */
  async function cambioBcp(url, chave) {
    if (!url) return null;
    try {
      const j = await pegar(url + (url.indexOf("?") < 0 ? "?" : "&") + "fonte=cambio_bcp&k=" + encodeURIComponent(chave || ""), "json", 45000);
      if (!j.ok) return null;
      const linhas = lerCambio(j.fontes.cambio_bcp);
      if (linhas.length) marca("bcp", "ok", "corte de " + linhas[linhas.length - 1].h + " · " + linhas[linhas.length - 1].d.slice(8) + "/" + linhas[linhas.length - 1].d.slice(5, 7));
      return linhas.length ? linhas : null;
    } catch (e) { return null; }
  }

  async function ypoti(url, chave) {
    const vazio = { compras: [], vendas: [], milho: [], contratosMilho: [], cambioBcp: [], ligado: false };
    if (!url) { marca("ypoti", "desligado", "ponte não configurada"); marca("bcp", "desligado", "ponte não configurada"); return vazio; }
    marca("ypoti", "atualizando");
    try {
      const j = await pegar(url + (url.indexOf("?") < 0 ? "?" : "&") + "k=" + encodeURIComponent(chave || ""), "json", 90000);
      if (!j.ok) throw new Error(j.erro === "chave" ? "chave de acesso incorreta" : (j.mensagem || "erro na ponte"));
      const out = { compras: [], vendas: [], milho: [], contratosMilho: [], cambioBcp: [], ligado: true };
      const avisos = [];

      // ---- compras de reposição (planilha em formato es: 1.234.567,89 quando vier como texto)
      let t = tabela(j.fontes.compras);
      if (t) {
        const n = (l, nome) => C.num(l[t.c(nome)], "es");
        for (const l of t.linhas) {
          const d = C.data(l[t.c("FECHA")]), cab = n(l, "CANTIDAD TOTAL"), peso = n(l, "PESO PROMEDIO POR CABEZA SIN DESBASTE"), pcab = n(l, "COSTO POR ANIMAL");
          if (!d || !(cab > 0) || !(peso > 30) || !(pcab > 0)) continue;
          const cat = String(l[t.c("@antes:CANTIDAD TOTAL")] || "").toUpperCase();
          out.compras.push({ d, cab, peso, pcab, pkg: pcab / peso, cat, sexo: /HEMBRA|VAQUILL|TERNERA/.test(cat) ? "Fêmea" : "Macho",
            pesoFaz: n(l, "PESO PROMEDIO POR CABEZA  BASCULA"), custoFaz: n(l, "COSTOS TOTAL POR CABEZA (PYG)"), cambio: n(l, "CAMBIO DEL DIA"),
            destino: l[t.c("ESTABLECIMENTO DE DESTINO")] || "", dono: l[t.c("PROPRIETARIO")] || "", depto: l[t.c("DEPARTAMENTO")] || "", raca: l[t.c("RAZA")] || "" });
        }
        out.compras.sort((a, b) => (a.d < b.d ? -1 : 1));
      } else avisos.push("compras");

      // ---- resultados do confinamento (formato us: $1,136.10)
      t = tabela(j.fontes.resultados);
      if (t) {
        const n = (l, nome) => C.num(l[t.c(nome)], "us");
        for (const l of t.linhas) {
          const d = C.data(l[t.c("DATA FINAL")]), cab = n(l, "Quantidade Abatida");
          if (!d || !(cab > 0)) continue;
          const cms = n(l, "CMS Médio Kg/cab/dia"), diaAlim = n(l, "U$/dia Alimento"), diaria = n(l, "U$/diaria (dieta +  operacional)");
          let rcF = n(l, "Rend. Final"), rcI = n(l, "Rend. Inicial");
          if (rcF > 1.5) rcF /= 100; if (rcI > 1.5) rcI /= 100;
          const dono = String(l[t.c("ESTABLECIMENTO")] || "").toUpperCase();
          out.vendas.push({ d, cab, lote: l[t.c("LOTE")] || "", cat: String(l[t.c("CATEGORIA")] || "").toUpperCase(), dono, rural: /RURAL\s*BIOENERG/.test(dono),
            preco: n(l, "Preço Venda U$/@"), gmd: n(l, "GMD"), dias: n(l, "Dias de cocho"), pesoIni: n(l, "PESO"), pesoFim: n(l, "PESO SAÍDA"), carc: n(l, "PESO CARCAZA"),
            rcIni: rcI, rcFin: rcF, cms, custoNutr: cms > 0 && diaAlim > 0 ? diaAlim / cms : null, gastosOp: diaria > 0 && diaAlim > 0 ? diaria - diaAlim : null,
            custoKg: n(l, "Custo/Kg Prod."), lucro: n(l, "Lucro/cab Conf."), frig: l[t.c("Frigorifico")] || "" });
        }
        out.vendas.sort((a, b) => (a.d < b.d ? -1 : 1));
      } else avisos.push("resultados");

      // ---- milho: entregas e contratos
      t = tabela(j.fontes.milho_entregas);
      if (t) {
        const n = (l, nome) => C.num(l[t.c(nome)], "es");
        for (const l of t.linhas) {
          const d = C.data(l[t.c("FECHA DE REMISION")]) || C.data(l[t.c("FECHA RECIBIDA EN YPOTI")]), prod = String(l[t.c("PRODUCTO")] || "").toUpperCase();
          const usd = n(l, "CONTRATO USD/TON"), kg = n(l, "CANTIDAD S/ REMISION EN KG");
          if (!d || !(usd > 20) || !(usd < 1000) || !(kg > 0) || /HUMED|SILA|ENSIL/.test(prod)) continue;
          out.milho.push({ d, usd, t: kg / 1000, posto: n(l, "COSTO TON + FLETE USD + DESCARGA (FEED MANAGER)"), prod });
        }
        out.milho.sort((a, b) => (a.d < b.d ? -1 : 1));
      } else avisos.push("milho");
      // contratos: a aba geral (2024) e as abas por safra ("Contracto Maiz Seco 2025 - 2026" em diante)
      const vistos = new Set();
      for (const nome of ["milho_contratos", "milho_contratos_safra"]) {
        t = tabela(j.fontes[nome]); if (!t) continue;
        const n = (l, c) => (t.c(c) == null ? null : C.num(l[t.c(c)], "es"));
        for (const l of t.linhas) {
          const d = C.data(l[t.c("FECHA")]), prod = String(l[t.c("PRODUCTO")] || "MAIZ SECO").toUpperCase();
          let usd = n(l, "PRECIO USD/TON"); const gs = n(l, "PRECIO Gs/TON"), cb = n(l, "CAMBIO          Gs/$");
          if (!(usd > 0) && gs > 0 && cb > 1000) usd = gs / cb;
          const ton = n(l, "CANTIDAD") || 0, id = d + "|" + usd + "|" + ton;
          if (!d || !(usd > 20) || !(usd < 1000) || /HUMED|SILA|ENSIL/.test(prod) || vistos.has(id)) continue;
          vistos.add(id);
          out.contratosMilho.push({ d, usd, t: ton, prod, frete: l[t.c("FLETE A CARGO DE")] || "" });
        }
      }
      out.contratosMilho.sort((a, b) => (a.d < b.d ? -1 : 1));
      // a planilha de entregas só traz preço até jan/2025; daí em diante o "nosso milho" são os contratos fechados (pela data do contrato)
      const ultEntrega = out.milho.length ? out.milho[out.milho.length - 1].d : "0000";
      for (const c of out.contratosMilho) if (c.d > ultEntrega && c.t > 0) out.milho.push({ d: c.d, usd: c.usd, t: c.t, posto: null, prod: c.prod, contrato: true });
      out.milho.sort((a, b) => (a.d < b.d ? -1 : 1));
      out.cambioBcp = lerCambio(j.fontes.cambio_bcp);
      const uc = out.cambioBcp[out.cambioBcp.length - 1];
      marca("bcp", uc ? "ok" : "erro", uc ? "corte de " + uc.h + " · " + uc.d.slice(8) + "/" + uc.d.slice(5, 7) : "planilha do câmbio não respondeu");
      marca("ypoti", avisos.length ? "desatualizado" : "ok", avisos.length ? "sem: " + avisos.join(", ") :
        out.vendas.length + " lotes · " + out.compras.length + " compras");
      return out;
    } catch (e) { marca("ypoti", "erro", String(e.message || e)); marca("bcp", "erro", "ponte fora do ar"); return vazio; }
  }

  window.Dados = { estado, ancoras, gordo, indicador, lotes, b3, cambio, ypoti, cambioBcp };
})();

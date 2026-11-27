// Teste local do painel: serve os arquivos, simula as fontes externas no formato real e tira capturas.
// As séries simuladas são SINTÉTICAS (só para conferir layout e contas); os últimos valores copiam os reais lidos em 26/11/2026.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, ".."), SAIDA = path.join(__dirname, "saida");
fs.mkdirSync(SAIDA, { recursive: true });
const semPonte = process.argv.includes("--sem-ponte"), movel = process.argv.includes("--movel");

let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const iso = (d) => d.toISOString().slice(0, 10);
const gd = (s) => { const [y, m, d] = s.split("-").map(Number); return "Date(" + y + "," + (m - 1) + "," + d + ")"; };
const gviz = (cols, rows) => "/*O_o*/\ngoogle.visualization.Query.setResponse(" + JSON.stringify({ version: "0.6", status: "ok", table: { cols: cols.map((c) => ({ label: c[0], type: c[1] })), rows: rows.map((r) => ({ c: r.map((v) => (v == null ? null : { v })) })) } }) + ");";

// ---- Valor Agro
const gordoCols = ["date", "ganado_a_frigorifico__novillo__semana_anterior", "ganado_a_frigorifico__novillo__semana_actual", "ganado_a_frigorifico__novillo_ue__semana_anterior", "ganado_a_frigorifico__novillo_ue__semana_actual",
  "ganado_a_frigorifico__vaquilla__semana_anterior", "ganado_a_frigorifico__vaquilla__semana_actual", "x", "y", "ganado_a_frigorifico__vacas__semana_anterior", "ganado_a_frigorifico__vacas__semana_actual"].map((c, i) => [c, i ? "number" : "date"]);
const gordoRows = []; { let p = 4.5, ant = 4.5; for (let d = new Date("2026-01-26T12:00:00Z"); iso(d) <= "2026-11-25"; d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() === 1) { ant = p; p = Math.round((p + (rnd() - 0.42) * 0.1) * 20) / 20; }
  let a = ant, c = p; if (iso(d) >= "2026-11-23") { a = 5.15; c = 5.0; }
  gordoRows.push([gd(iso(d)), a, c, a + 0.05, c + 0.05, a, c, null, null, a - 0.3, c - 0.25]); if (rnd() < 0.3) gordoRows.push(gordoRows[gordoRows.length - 1]); } }

// ---- INDICADOR (semanal)
const ind = []; { let beta = 7209, cM = 133.9, cF = 120.6; const n = 408; for (let i = 0; i < n; i++) { const d = new Date(Date.UTC(2019, 1, 4 + 7 * i, 12));
  const alvo = 7209 + (13235 - 7209) * Math.pow(i / (n - 1), 1.6) + 900 * Math.sin(i / 23); beta += (alvo - beta) * 0.25 + gauss() * 60; cM += (126.9 - cM) * 0.01 + gauss() * 0.4; cF += (103.1 - cF) * 0.01 + gauss() * 0.4;
  if (i === n - 1) { beta = 13235; cM = 126.9; cF = 103.1; }
  const m = (w) => Math.round(beta * (1 + cM / w)), f = (w) => Math.round(beta * (1 + cF / w)), lot = i === n - 1 ? 0 : Math.max(0, Math.round(6 + gauss() * 4));
  ind.push([gd(iso(d)), m(180), m(230), m(300), m(360), f(180), f(230), f(300), f(360), lot, lot / (lot + 4), lot ? m(230) : null, lot ? "negócios" : "repetição", Math.round(beta), Math.round(beta * cM / 1000) * 1000, Math.round(beta * cF / 1000) * 1000,
    +cM.toFixed(1), +cF.toFixed(1), -0.054, -0.036, 26, 216, 0.728, 0.057, i === n - 1 ? "em curso" : "fechada"]); } }
const indCols = ["Semana (segunda-feira)|date", "Macho (Gs/kg de peso vivo) 180 kg|number", "230 kg|number", "300 kg|number", "360 kg|number", "Fêmea 180 kg|number", "230 kg|number", "300 kg|number", "360 kg|number", "Lotes|number", "Peso|number", "Leitura|number", "Origem|string",
  "β|number", "α macho|number", "α fêmea|number", "c macho|number", "c fêmea|number", "t|number", "i|number", "j|number", "l|number", "r2|number", "res|number", "Situação|string"].map((c) => c.split("|"));
const indEm = (d) => { let r = ind[0]; for (const x of ind) { const dd = /Date\((\d+),(\d+),(\d+)\)/.exec(x[0]); const s = dd[1] + "-" + String(+dd[2] + 1).padStart(2, "0") + "-" + String(dd[3]).padStart(2, "0"); if (s <= d) r = x; else break; } return r; };

// ---- BASE (lotes)
const lotes = []; for (let k = 0; k < 520; k++) { const d = new Date(Date.UTC(2026, 10, 24 - Math.floor(rnd() * 400), 12)), s = iso(d), r = indEm(s), macho = rnd() < 0.6, w = Math.round(110 + rnd() * 310);
  const fonte = ["Everdem", "Tropeando", "Invernada"][Math.floor(rnd() * 3)], pkg = Math.round(r[13] * (1 + (macho ? r[16] : r[17]) / w) * Math.exp(gauss() * 0.09 + (fonte === "Everdem" ? 0.03 : -0.02)));
  lotes.push([fonte, gd(s), macho ? "Desmamante macho" : "Vaquilla", macho ? "Macho" : "Fêmea", Math.round(20 + rnd() * 120), w, pkg * w, pkg, fonte === "Everdem" ? 6100 + Math.round(rnd() * 200) : null]); }
const baseCols = ["fonte|string", "data|date", "categoria_padrao|string", "sexo|string", "cabecas|number", "peso_kg|number", "preco_cab_gs|number", "preco_kg_gs|number", "cotizacao_gs_usd|number"].map((c) => c.split("|"));

// ---- B3 (valores reais de 26/11/2026)
const b3 = { BGI: [["BGIX26", "2026-11-30", 396.55, 396.75, 19159], ["BGIZ26", "2026-12-30", 407.4, 407.95, 21253], ["BGIF27", "2027-01-29", 409, 410, 8752], ["BGIG27", "2027-02-26", 409.05, 410, 4052], ["BGIH27", "2027-03-31", 409.05, 410, 2578], ["BGIJ27", "2027-04-30", null, 406.25, 276],
    ["BGIK27", "2027-05-31", null, 402.55, 482], ["BGIM27", "2027-06-30", null, 407.8, 23], ["BGIN27", "2027-07-30", null, 405.7, 4], ["BGIQ27", "2027-08-31", null, 405.8, null], ["BGIU27", "2027-09-30", null, 410.85, null], ["BGIV27", "2027-10-29", null, 411.85, 154], ["BGIX27", "2027-11-30", null, 411.85, 1]],
  CCM: [["CCMF27", "2027-01-15", 70.45, 70.76], ["CCMH27", "2027-03-15", 75.2, 75.62], ["CCMK27", "2027-05-17", 74.4, 74.59], ["CCMN27", "2027-07-15", 74.4, 74.52], ["CCMU27", "2027-09-15", 75.1, 75.03], ["CCMX27", "2027-11-16", 77.4, 77.63], ["CCMF28", "2028-01-17", null, 79.83]],
  DOL: [["DOLZ26", "2026-12-01", 5625, 5746.512], ["DOLF27", "2027-01-04", 5666.5, 5779.633], ["DOLG27", "2027-02-01", null, 5812.432], ["DOLH27", "2027-03-01", null, 5840.053], ["DOLJ27", "2027-04-01", null, 5876.08], ["DOLK27", "2027-05-03", null, 5908.464], ["DOLM27", "2027-06-01", null, 5941.172],
    ["DOLN27", "2027-07-01", null, 5981.009], ["DOLQ27", "2027-08-02", null, 6017.799], ["DOLU27", "2027-09-01", null, 6055.876], ["DOLV27", "2027-10-01", null, 6091.634], ["DOLX27", "2027-11-01", null, 6124.791]] };
const b3json = (t) => JSON.stringify({ BizSts: { cd: "OK" }, Msg: { dtTm: "2026-11-26 22:34:36" }, Scty: b3[t].map((c) => ({ symb: c[0], SctyQtn: Object.assign({ prvsDayAdjstmntPric: c[3] }, c[2] ? { curPrc: c[2] } : {}), asset: { AsstSummry: { mtrtyCode: c[1], opnCtrcts: c[4] || 0 }, code: t }, mkt: { cd: "FUT" } }))
  .concat([{ symb: t + "Z26C000400", SctyQtn: { exrcPric: 400 }, asset: { AsstSummry: { mtrtyCode: "2026-12-30" } } }]) });

// ---- câmbio
const fxHist = (ini, fim, n) => { const out = []; for (let i = 0; i < n; i++) { const d = new Date(Date.UTC(2026, 10, 26 - i, 12)); out.push({ bid: String((fim + (ini - fim) * (i / n) + Math.sin(i / 40) * (fim * 0.02)).toFixed(4)), timestamp: String(Math.floor(d.getTime() / 1000)) }); } return JSON.stringify(out); };

// ---- ponte Ypoti (mesmo formato do Apps Script; mistura números e textos formatados para exercitar os dois caminhos)
const es = (v, d) => v.toLocaleString("es-PY", { minimumFractionDigits: d, maximumFractionDigits: d });
const compras = []; for (let k = 0; k < 420; k++) { const d = new Date(Date.UTC(2026, 10, 19 - Math.floor(rnd() * 900), 12)), s = iso(d), r = indEm(s), tor = rnd() < 0.25, w = tor ? 300 + rnd() * 90 : 150 + rnd() * 110, cab = Math.round(20 + rnd() * 250);
  const pkg = r[13] * (1 + r[16] / w) * Math.exp(-0.035 + gauss() * 0.06), pcab = pkg * w, txt = rnd() < 0.5;
  compras.push([txt ? s.slice(8) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : s, "RURAL BIOENERGIA S.A", "CONCEPCION", "YPOTI", s, "ENTREGUE", tor ? "TORETON" : "DESMAMANTES MACHOS", txt ? String(cab) : cab, "CABEZA", pcab, txt ? es(w, 2) : w, txt ? es(w * 0.97, 1) : w * 0.97, -0.02,
    txt ? es(pcab, 2) : pcab, pkg, pkg * 1.04, 40000, 50000, txt ? es(pcab + 90000, 2) : pcab + 90000, txt ? es(6100 + rnd() * 300, 2) : 6100 + rnd() * 300, pkg * 1.05, 5.0, 0.3, "HIBRIDO"]); }
const mesAb = ["Jan", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
const result = []; for (let k = 0; k < 700; k++) { const d = new Date(Date.UTC(2026, 10, 23 - Math.floor(rnd() * 1900), 12)), s = iso(d); if ([1, 2].includes(d.getUTCMonth()) && rnd() < 0.9) continue;
  const t = (d - new Date("2021-08-01")) / (new Date("2026-11-23") - new Date("2021-08-01")), preco = Math.round((3.6 + 2.4 * Math.pow(Math.max(0, t), 1.4) + gauss() * 0.06) * 20) / 20, rural = rnd() < 0.6, txt = rnd() < 0.5, gmd = 1.45 + gauss() * 0.12, cms = 10.6 + gauss() * 0.6, alim = cms * (0.22 + 0.06 * t + gauss() * 0.01);
  result.push(["LOTE " + k, rnd() < 0.93 ? "TORO" : "VAQUILLAS", "CEBU", rural ? "RURAL BIOENERGIA SA" : "BAHIA RICA", s.slice(0, 4), null, 385 + gauss() * 20, txt ? s.slice(8) + "-" + mesAb[d.getUTCMonth()] + ".-" + s.slice(2, 4) : s, 570, 320, txt ? gmd.toFixed(3) : gmd, 160, 118, txt ? "50.00%" : 0.5, txt ? (55.6 + gauss()).toFixed(2) + "%" : 0.556 + gauss() * 0.008,
    txt ? cms.toFixed(2) : cms, 2.4, 130, 1100, txt ? "$" + (alim + 0.42).toFixed(2) : alim + 0.42, txt ? "$" + alim.toFixed(2) : alim, 2.3, 300, 1400, txt ? "$" + preco.toFixed(2) : preco, 1900, 480, 480, 1.05, "Minerva", 3.0, rural ? "" : "Boitel", "BOVINO"]); }
const milho = []; for (let k = 0; k < 900; k++) { const d = new Date(Date.UTC(2026, 10, 25 - Math.floor(rnd() * 1000), 12)), s = iso(d); milho.push([s, s, rnd() < 0.85 ? "MAIZ SECO" : "MAIZ HUMEDO", 150, Math.round(128 + 30 * Math.sin(k / 90) + 20 * rnd()), 6200, null, "USD", 30000 + rnd() * 6000, 0, 150]); }
const F = (cab, linhas) => ({ cab, linhas, faltando: [] });
const ponte = JSON.stringify({ ok: true, versao: "teste", fontes: {
  compras: F(["FECHA", "PROPRIETARIO", "DEPARTAMENTO", "ESTABLECIMENTO DE DESTINO", "FECHA DE CHEGADA EN LA ESTANCIA", "STATUS", "@antes:CANTIDAD TOTAL", "CANTIDAD TOTAL", "CATEGORIA", "PRECIO LIQUIDADO", "PESO PROMEDIO POR CABEZA SIN DESBASTE", "PESO PROMEDIO POR CABEZA  BASCULA", "DESBASTE", "COSTO POR ANIMAL", "COSTO KG COMPRA", "COSTO KG ESTANCIA", "COSTO FLETE POR ANIMAL", "COSTO COMISIÓN POR ANIMAL", "COSTOS TOTAL POR CABEZA (PYG)", "CAMBIO DEL DIA", "COSTOS TOTAL POR KILO (PYG - con desbaste)", "VALOR AGRO - NOVILLO DEL DIA (US)", "AGIO PRECIO VENTA", "RAZA"], compras),
  resultados: F(["LOTE", "CATEGORIA", "RAZA", "ESTABLECIMENTO", "SAFRA", "DATA INICIAL", "PESO", "DATA FINAL", "PESO SAÍDA", "PESO CARCAZA", "GMD", "Quantidade Abatida", "Dias de cocho", "Rend. Inicial", "Rend. Final", "CMS Médio Kg/cab/dia", "CMS % P.V.", "Kg de carcaça produzidos", "U$/Cab. Entrada", "U$/diaria (dieta +  operacional)", "U$/dia Alimento", "Custo/Kg Prod.", "Custo Conf.", "Custo Total U$/cab.", "Preço Venda U$/@", "Receita total", "Lucro/cab Conf.", "Lucro/cab Total", "Ganho em Carcaça", "Frigorifico", "Valor da diária", "Boitel", "Sistema"], result),
  milho_entregas: F(["FECHA RECIBIDA EN YPOTI", "FECHA DE REMISION", "PRODUCTO", "COSTO ACTUAL DE MERCADO USD/TON", "CONTRATO USD/TON", "CAMBIO DEL DIA", "CONTRATO GS/TON", "MONEDA", "CANTIDAD S/ REMISION EN KG", "COSTO DEL FLETE USD", "COSTO TON + FLETE USD + DESCARGA (FEED MANAGER)"], milho),
  milho_contratos: F(["ANO", "FECHA", "PRODUCTO", "CANTIDAD", "CAMBIO          Gs/$", "PRECIO USD/TON", "PRECIO Gs/TON", "ESTADO DEL CONTRATO", "FLETE A CARGO DE"], [[2026, "2026-06-10", "MAIZ SECO", 3000, "USD", 140, null, "ABIERTO", "VENDEDOR"]]) } });

const tipos = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });

(async () => {
  await new Promise((ok) => srv.listen(8765, ok));
  const nav = await chromium.launch();
  const ctx = await nav.newContext(movel ? { viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 } : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); const erros = [];
  pg.on("console", (m) => { if (m.type() === "error" || /MercadoBoi/.test(m.text())) erros.push(m.type() + ": " + m.text()); });
  pg.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  await pg.clock.install({ time: new Date("2026-11-26T22:40:00-03:00") }).catch(() => {});
  await pg.route("**/*", (rota) => { const u = rota.request().url();
    if (u.startsWith("http://localhost:8765")) return rota.continue();
    if (u.includes("echarts.min.js")) return rota.fulfill({ path: require.resolve("echarts/dist/echarts.min.js"), contentType: "text/javascript" });
    if (u.includes("docs.google.com")) { const txt = u.includes("sheet=Sheet1") ? gviz(gordoCols, gordoRows) : u.includes("sheet=INDICADOR") ? gviz(indCols, ind) : gviz(baseCols, lotes); return rota.fulfill({ body: txt, contentType: "text/javascript" }); }
    if (u.includes("cotacao.b3.com.br")) return rota.fulfill({ body: b3json(u.split("/").pop()), contentType: "application/json" });
    if (u.includes("awesomeapi")) { if (u.includes("/last/")) return rota.fulfill({ body: JSON.stringify({ USDBRL: { bid: "5.6513" }, USDPYG: { bid: "6208.9269" } }), contentType: "application/json" });
      return rota.fulfill({ body: u.includes("USD-PYG") ? fxHist(6900, 6209, 2900) : fxHist(5.4, 5.65, 400), contentType: "application/json" }); }
    if (u.includes("script.google.com")) return rota.fulfill({ body: ponte, contentType: "application/json" });
    return rota.abort(); });
  const q = semPonte ? "" : "?ponte=" + encodeURIComponent("https://script.google.com/macros/s/TESTE/exec") + "&k=abc";
  await pg.goto("http://localhost:8765/" + q, { waitUntil: "load" });
  await pg.clock.runFor(4000).catch(() => {}); await pg.waitForTimeout(2500);
  const suf = (semPonte ? "-semponte" : "") + (movel ? "-movel" : "");
  for (const [i, t] of ["gordo", "reposicao", "lucro"].entries()) {
    await pg.keyboard.press(String(i + 1)); await pg.clock.runFor(3500).catch(() => {}); await pg.waitForTimeout(2600);
    await pg.screenshot({ path: SAIDA + "/" + t + suf + ".png", fullPage: movel });
  }
  if (!movel && !semPonte) { await pg.keyboard.press("c"); await pg.clock.runFor(1500).catch(() => {}); await pg.waitForTimeout(900); await pg.screenshot({ path: SAIDA + "/config.png" }); await pg.keyboard.press("Escape"); }
  const resumo = await pg.evaluate(() => { const M = window.MercadoBoi.modelo; if (!M) return null; const A = M.lucro.atual;
    return { pyHoje: M.boi.pyHoje, vendaHoje: M.boi.vendaHoje, basisHoje: M.boi.basisHoje, curva0: M.boi.curva[0], milho0: M.milho.curva[0], sazBoiNov: M.boi.saz[10], sazMilhoJan: M.milho.saz[0],
      repo: M.repo.u && { m180: M.repo.u.m180, beta: M.repo.u.beta }, desvio: M.repo.desvioRec, nRec: M.repo.nRec, agio: M.repo.agioHoje, lucro: A.global.lucro, tir: A.global.tir, pHoje: M.lucro.pHoje, n: M.lucro.serie.length,
      estado: Object.fromEntries(Object.entries(window.Dados.estado).map(([k, v]) => [k, v.estado + " " + v.nota])), rolagem: document.documentElement.scrollWidth > innerWidth }; });
  console.log(JSON.stringify(resumo, null, 1)); console.log("ERROS:", erros.length ? erros.join("\n") : "nenhum");
  await nav.close(); srv.close();
})();

// Conferência do motor contra a planilha Rentabilidade_Invernista.xlsx (aba "Recria e Engorda") e dos parsers.
const C = require("../js/calc.js");
let falhas = 0;
const ok = (nome, got, exp, tol = 1e-6) => { const p = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)); if (!p) falhas++; console.log((p ? "ok   " : "FALHA") + " " + nome + ": " + got + " (Excel " + exp + ")"); };
const eq = (nome, got, exp) => { const p = got === exp; if (!p) falhas++; console.log((p ? "ok   " : "FALHA") + " " + nome + ": " + got + " (esperado " + exp + ")"); };
const r = C.lucratividade(C.PADRAO);
ok("recria peso final", r.recria.pesoFim, 329.45);
ok("recria receita", r.recria.receita, 916.2585882352939);
ok("recria custos", r.recria.custos, 845.0528012214259);
ok("recria lucro", r.recria.lucro, 71.20578701386808);
ok("recria TIR", r.recria.tir, 0.10165563713027748);
ok("RIP receita", r.rip.receita, 1067.4740099071207);
ok("RIP custos", r.rip.custos, 1043.5510136986302);
ok("RIP lucro", r.rip.lucro, 23.92299620849053);
ok("RIP TIR", r.rip.tir, 0.14784185285942786);
ok("conf peso final", r.conf.pesoFim, 563.45);
ok("conf carcaça", r.conf.carcFim, 317.22235);
ok("conf GDC", r.conf.gdc, 1.0208112500000002);
ok("conf receita", r.conf.receita, 1830.6901818499998);
ok("conf custos", r.conf.custos, 1526.9664827176723);
ok("conf lucro", r.conf.lucro, 303.7236991323275);
ok("conf lucro anualizado", r.conf.lucroAno, 923.8262515274961);
ok("conf TIR", r.conf.tir, 0.736355980082823);
ok("conf custo kg produzido", r.conf.custoKgProd, 3.5380357207727346);
ok("global lucro", r.global.lucro, 416.0177170296088);
ok("global TIR (XTIR)", r.global.tir, 0.27863243222236633, 1e-5);
eq("global ciclo", r.global.ciclo, 515);
// parsers
eq("data gviz", C.data("Date(2026,10,25)"), "2026-11-25");
eq("data dd/mm/aaaa", C.data("09/11/2026"), "2026-11-09");
eq("data 17-Nov.-26", C.data("17-Nov.-26"), "2026-11-17");
eq("data 11-set.-17", C.data("11-set.-17"), "2017-09-11");
eq("data 01-Oct.-26", C.data("01-Oct.-26"), "2026-10-01");
eq("data 04-Ago.-26", C.data("04-Ago.-26"), "2026-08-04");
eq("data 4-jan.-2021", C.data("4-jan.-2021"), "2021-01-04");
eq("num es milhar", C.num("5.904.315,00", "es"), 5904315);
eq("num es decimal", C.num("286,8", "es"), 286.8);
eq("num es 20.345,68", C.num("20.345,68", "es"), 20345.68);
eq("num us $", C.num("$1,136.10", "us"), 1136.1);
eq("num us gmd", C.num("1.650", "us"), 1.65);
eq("num us diarias", C.num("19,312", "us"), 19312);
ok("num %", C.num("55.90%", "us"), 0.559);
eq("num neg", C.num("-$3,128.54", "us"), -3128.54);
eq("num erro", C.num("#DIV/0!", "es"), null);
ok("quantil", C.quantil([1, 2, 3, 4, 5], 0.1), 1.4);
ok("precoKg indicador 180", C.precoKg(13235, 126.9, 180), 22565, 1e-4);
const pm = C.preencher(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"], new Map([["2026-02", 10], ["2026-04", 20]]));
eq("preencher", JSON.stringify(pm.v), "[10,10,15,20,20]");
// análise técnica
eq("mms", JSON.stringify(C.mms([1, 2, 3, 4, 5], 3)), "[null,null,2,3,4]");
ok("ifr só altas", C.ifr([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14)[15], 100);
// IFR(14) do exemplo clássico de Wilder: 70,46 no 15º fechamento
const w = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
ok("ifr Wilder", C.ifr(w, 14)[14], 70.46, 2e-3); ok("ifr Wilder +1", C.ifr(w, 14)[15], 66.25, 2e-3);
const pv = C.picosVales([100, 101, 103, 102, 99, 98, 100, 104, 103.5], 0.02);
eq("picos e vales", JSON.stringify(pv.map((x) => [x.i, x.tipo, x.confirmado])), '[[0,"vale",true],[2,"pico",true],[5,"vale",true],[7,"pico",false]]');
ok("mediana", C.mediana([5, 1, 3, null, 9]), 4);
const wl = C.mqoPond([100, 200, 300, 400], [5, 7, 9, 11], [10, 50, 5, 80]);
ok("mqo ponderado beta", wl.beta, 0.02); ok("mqo ponderado alfa", wl.alfa, 3);
eq("mme", JSON.stringify(C.mme([1, 2, 3], 3)), "[1,1.5,2.25]");
const bb = C.bollinger(Array.from({ length: 20 }, (_, i) => 100 + (i % 2)), 20, 2); ok("bollinger média", bb.media, 100.5); ok("bollinger sup", bb.sup, 101.5);
const serieT = Array.from({ length: 80 }, (_, i) => 100 * Math.exp(0.001 * i + 0.01 * Math.sin(i)));
const pj = C.projetar(serieT, 42); eq("projeção pontos", pj.pontos.length, 42);
eq("projeção ordem das faixas", pj.pontos.every((x) => x.i80 < x.i50 && x.i50 < x.med && x.med < x.s50 && x.s50 < x.s80), true);
ok("projeção leque cresce com a raiz do tempo", Math.log(pj.pontos[39].s80 / pj.pontos[39].med) / Math.log(pj.pontos[9].s80 / pj.pontos[9].med), 2, 1e-9);

// ---- conta manual da apresentação "Rentabilidade Histórica" (out/2025): recria 316,458; confinamento 166,509
{
  const perto = (nome, got, exp, tolAbs) => { const p = Math.abs(got - exp) <= tolAbs; if (!p) falhas++; console.log((p ? "ok   " : "FALHA") + " " + nome + ": " + got.toFixed(3) + " (pptx " + exp + ")"); };
  const fx = 359.795 * 18765.432 / (1405.537 - 287.657 - 166.509);
  const r = C.lucroYpoti(C.mesclar(C.PADRAO_YPOTI, { desmamante: 21089.903, toreton: 18765.432, cambio: fx, venda: 4.867, pesoEntrada: 359.795, pesoSaida: 509.953, rc: 0.566, dias: 111.632, diaria: 2.577 }));
  perto("pptx out/25 receita", r.conf.receita, 1405.537, 1.5);
  perto("pptx out/25 engorda", r.conf.engorda, 287.657, 0.2);
  perto("pptx out/25 lucro conf", r.conf.lucro, 166.509, 1.5);
  perto("pptx out/25 lucro recria", r.recria.lucro, 316.458, 0.5);
  if (!(r.global.tir > 0.1 && r.global.tir < 1)) throw new Error("TIR do ciclo fora do esperado: " + r.global.tir);
  const b = C.mqoMulti([[1, 1], [1, 2], [1, 3], [1, 4]], [3, 5, 7, 9]);
  perto("mqoMulti a", b[0], 1, 1e-9); perto("mqoMulti b", b[1], 2, 1e-9);
}
// ---- régua de 2º grau: lotes sintéticos com forma conhecida
{
  const perto = (nome, got, exp, tolAbs) => { const p = Math.abs(got - exp) <= tolAbs; if (!p) falhas++; console.log((p ? "ok   " : "FALHA") + " " + nome + ": " + (+got).toFixed(5) + " (esperado " + exp + ")"); };
  const ind = [], lotes = []; let d = "2025-01-06";
  for (let s = 0; s < 40; s++) { const beta = 10000 + s * 50; ind.push({ d, beta, fT: -0.05, fI: -0.03 });
    for (let i = 0; i < 6; i++) { const w = 140 + ((s * 6 + i) * 37) % 260, fonte = ["Everdem", "Tropeando", "Invernada"][i % 3];
      const f = fonte === "Tropeando" ? -0.05 : fonte === "Invernada" ? -0.03 : 0, fb = 0.25 * -0.05 + 0.25 * -0.03;
      lotes.push({ d: C.somaDias(d, 2), sexo: "Macho", peso: w, fonte, pkg: beta * (1.1 + 90 / w - 0.0004 * w) * Math.exp(f - fb) }); }
    d = C.somaDias(d, 7); }
  const g = C.reguaQuad(lotes, ind, { curta: 26, longa: 52, minCurta: 60, minimo: 30 }).get(ind[39].d);
  perto("régua 2º grau k", g.k, 1.1, 1e-6); perto("régua 2º grau c", g.c, 90, 1e-4); perto("régua 2º grau q", g.q, -0.0004, 1e-9);
  const pt = C.pontoQuad(10000, g, 180); perto("β marginal em 180 kg", pt.b, 10000 * (1.1 - 2 * 0.0004 * 180), 1e-3);
}
console.log(falhas ? "\n" + falhas + " FALHA(S)" : "\nTudo confere.");
process.exit(falhas ? 1 : 0);

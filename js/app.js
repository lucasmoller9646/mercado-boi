/* Mercado do Boi — estado da página: configurações, carga dos dados, troca e rotação de telas. */
(function () {
  "use strict";
  const CFG = window.MB_CONFIG, C = window.Calc, T = window.Telas;
  const TELAS = ["gordo", "reposicao", "lucro", "cambio"];
  const DESENHO = { gordo: T.telaGordo, reposicao: T.telaReposicao, lucro: T.telaLucro, cambio: T.telaCambio };
  const $ = (id) => document.getElementById(id);
  const guarda = { ler(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento: vale só nesta sessão */ } } };

  // ------------------------------------------------------------------ configurações
  let S = Object.assign({}, CFG.padroes, { ponte: CFG.ponte, chave: "", efeitos: "completos", params: {} }, guarda.ler("mb:cfg") || {});
  (function daUrl() { // ?rotacao=45&tela=reposicao&ponte=...&k=... (a chave sai da barra de endereço depois de guardada)
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.replace(/^#/, "")); let mudou = false;
    for (const k of ["k", "ponte"]) if (h.has(k)) { q.set(k, h.get(k)); h.delete(k); }
    if (q.has("rotacao")) { S.rotacao = Math.max(0, +q.get("rotacao") || 0); mudou = true; }
    if (q.has("ponte")) { S.ponte = q.get("ponte"); mudou = true; }
    if (q.has("k")) { S.chave = q.get("k"); mudou = true; }
    if (mudou) { guarda.gravar("mb:cfg", S); if (q.has("k") || q.has("ponte")) { q.delete("k"); q.delete("ponte"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + (h.toString() ? "#" + h : "")); } }
  })();

  const CAMPOS = [
    { grupo: "Exibição", itens: [
      { k: "rotacao", r: "Trocar de tela a cada (segundos, 0 = parado)", passo: 5, min: 0 },
      { k: "atualizar", r: "Atualizar os dados a cada (minutos)", passo: 1, min: 2 },
      { k: "anos", r: "Anos de histórico nos gráficos", passo: 1, min: 1 },
      { k: "efeitos", r: "Efeitos visuais", op: [["completos", "Completos (vidro e movimento)"], ["leves", "Leves (TV ou computador lento)"]] },
    ] },
    { grupo: "Dados da Ypoti (ponte no Google Apps Script)", dica: "Compras, vendas do confinamento e milho vêm das planilhas internas por um endereço protegido por chave. A chave fica guardada só neste navegador.", itens: [
      { k: "ponte", r: "Endereço do app da Web", texto: true, largo: true }, { k: "chave", r: "Chave de acesso", texto: true, largo: true, segredo: true },
      { k: "lotesPreco", r: "Lotes usados no preço e nos indicadores", op: [["rural", "Só os da Rural Bioenergia"], ["todos", "Todos os lotes"]] },
      { k: "premioSemDados", r: "Prêmio sobre o Valor Agro sem venda nossa (US$/kg)", passo: 0.05 },
      { k: "vendaManual", r: "Nosso preço de venda à mão (US$/kg, 0 = planilha)", passo: 0.05, min: 0 },
    ] },
    { grupo: "Basis e reposição", itens: [
      { k: "qmin", r: "Quantil mínimo do basis", passo: 0.05, min: 0, max: 0.5 }, { k: "qmax", r: "Quantil máximo do basis", passo: 0.05, min: 0.5, max: 1 },
      { k: "basisAnosBoi", r: "Anos no basis do boi (0 = desde 2015)", passo: 1, min: 0 }, { k: "basisAnosMilho", r: "Anos no basis do milho (0 = desde 2019)", passo: 1, min: 0 },
      { k: "rcVivo", r: "Rendimento do gordo para o ágio", passo: 0.01 }, { k: "semanasNuvem", r: "Semanas de leilão na nuvem α + β", passo: 1, min: 2 },
      { k: "diasCompras", r: "Dias das nossas compras em destaque", passo: 15, min: 15 },
      { k: "baseCompra", r: "Nossas compras contra o leilão: base da comparação", largo: true, op: [["vendedor", "Preço por cabeça ÷ peso do vendedor"], ["balanca", "Preço por cabeça ÷ peso de balança na chegada"], ["posto", "Custo posto fazenda (com frete e comissão) ÷ peso de balança"]] },
      { k: "ivaCompras", r: "IVA embutido no nosso preço (ex.: 0,05)", passo: 0.01, min: 0, max: 0.2 }, { k: "comissaoLeilao", r: "Comissão do comprador no leilão (ex.: 0,03)", passo: 0.005, min: 0, max: 0.2 },
      { k: "limiarPivo", r: "Reversão que confirma pico ou vale do câmbio", passo: 0.005, min: 0.005 },
    ] },
    { grupo: "Lucratividade — o que varia", itens: [
      { k: "indicadores", r: "Indicadores do confinamento", largo: true, op: [["realizado", "Realizado (Resultados do Confinamento)"], ["fixo", "Fixos da planilha"]] },
      { p: "fatorToretonGordo", r: "Toretón gordo ÷ toretón 360 kg", passo: 0.005 }, { p: "juros", r: "Juros (ao ano)", passo: 0.005 },
      { p: "prazoRecebimento", r: "Prazo de recebimento (dias)", passo: 5 },
      { k: "ripIndexada", r: "Diária da RIP nos meses passados", largo: true, op: [["nao", "Fixa, a de hoje"], ["sim", "Acompanha o custo nutricional de cada mês"]] },
    ] },
    { grupo: "Recria a pasto", itens: [
      { p: "recria.pesoIni", r: "Peso inicial (kg)", passo: 5 }, { p: "recria.gmd", r: "GMD (kg/dia)", passo: 0.01 }, { p: "recria.dias", r: "Dias no pasto", passo: 5 },
      { p: "recria.quebra", r: "Quebra do toretón", passo: 0.005 }, { p: "recria.custoMes", r: "Custo de produção (US$/cab-mês)", passo: 0.5 },
      { p: "recria.outros", r: "Outros custos (US$/cab)", passo: 1 }, { p: "recria.mortAnual", r: "Mortalidade anual", passo: 0.001 },
    ] },
    { grupo: "RIP (pré-confinamento)", itens: [
      { p: "rip.gmd", r: "GMD (kg/dia)", passo: 0.05 }, { p: "rip.dias", r: "Dias no pasto", passo: 5 }, { p: "rip.quebra", r: "Quebra", passo: 0.005 },
      { p: "rip.diaria", r: "Custo da diária (US$/cab-dia)", passo: 0.01 }, { p: "rip.outros", r: "Outros custos (US$/cab)", passo: 1 }, { p: "rip.mort", r: "Mortalidade", passo: 0.001 },
    ] },
    { grupo: "Confinamento", dica: "GMD, rendimento final, consumo, custo nutricional e gastos operacionais só valem daqui quando os indicadores estão em “Fixos da planilha”.", itens: [
      { p: "conf.gmd", r: "GMD (kg/dia)", passo: 0.01 }, { p: "conf.dias", r: "Dias de cocho", passo: 5 }, { p: "conf.rcIni", r: "RC inicial", passo: 0.005 }, { p: "conf.rcFin", r: "RC final", passo: 0.001 },
      { p: "conf.quebra", r: "Quebra", passo: 0.005 }, { p: "conf.custoNutr", r: "Custo nutricional (US$/kg MS)", passo: 0.01 }, { p: "conf.consumo", r: "Consumo (kg MS/dia)", passo: 0.1 },
      { p: "conf.gastosOp", r: "Gastos operacionais (US$/cab-dia)", passo: 0.01 }, { p: "conf.outros", r: "Outros custos (US$/cab)", passo: 1 }, { p: "conf.mort", r: "Mortalidade", passo: 0.001 },
    ] },
  ];
  const pegaCaminho = (o, cam) => cam.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  function poeCaminho(o, cam, v) { const ks = cam.split("."); let x = o; for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]] = x[ks[i]] || {}; x[ks[ks.length - 1]] = v; }

  function montarFormulario() {
    const efetivos = C.mesclar(C.PADRAO, S.params || {});
    $("form-config").innerHTML = CAMPOS.map((g) => "<fieldset><legend>" + g.grupo + "</legend>" + (g.dica ? '<p class="dica">' + g.dica + "</p>" : "") + '<div class="campos">' + g.itens.map((c) => {
      const id = "cfg-" + (c.k || c.p).replace(/\./g, "-"), v = c.k ? S[c.k] : pegaCaminho(efetivos, c.p);
      const ctl = c.op ? '<select id="' + id + '">' + c.op.map(([a, b]) => '<option value="' + a + '"' + (a === v ? " selected" : "") + ">" + b + "</option>").join("") + "</select>" :
        '<input id="' + id + '" type="' + (c.segredo ? "password" : c.texto ? "text" : "number") + '"' + (c.texto ? "" : ' step="' + (c.passo || "any") + '"' + (c.min != null ? ' min="' + c.min + '"' : "") + (c.max != null ? ' max="' + c.max + '"' : "")) +
        ' value="' + String(v == null ? "" : v).replace(/"/g, "&quot;") + '"' + (c.texto ? ' spellcheck="false"' : "") + ">";
      return '<label class="campo' + (c.largo ? " largo" : "") + '" for="' + id + '">' + c.r + ctl + "</label>";
    }).join("") + "</div></fieldset>").join("") +
      '<p class="atalhos"><kbd>1</kbd> a <kbd>4</kbd> telas · <kbd>←</kbd> <kbd>→</kbd> anterior e próxima · <kbd>R</kbd> liga ou desliga a rotação · <kbd>F</kbd> tela cheia · <kbd>C</kbd> configurações. ' +
      "Para abrir já girando: acrescente <b>?rotacao=45</b> ao endereço.</p>";
  }
  function lerFormulario() {
    const params = {};
    for (const g of CAMPOS) for (const c of g.itens) {
      const el = $("cfg-" + (c.k || c.p).replace(/\./g, "-")); if (!el) continue;
      const v = c.op || c.texto ? el.value.trim() : parseFloat(String(el.value).replace(",", "."));
      if (!(c.op || c.texto) && !isFinite(v)) continue;
      if (c.k) S[c.k] = v; else if (v !== pegaCaminho(C.PADRAO, c.p)) poeCaminho(params, c.p, v);
    }
    S.params = params;
    guarda.gravar("mb:cfg", S);
  }
  function abrirGaveta(abre) {
    if (abre) montarFormulario();
    $("gaveta").classList.toggle("aberta", abre); $("gaveta").setAttribute("aria-hidden", String(!abre)); $("veu").hidden = !abre;
    if (abre) pararRotacao(); else agendarRotacao();
  }

  // ------------------------------------------------------------------ bolinha de informação de cada cartão
  const INFO = window.MB_INFO || {}; let infoDe = null;
  function fecharInfo() { const b = $("balao-info"); if (b) b.hidden = true; if (infoDe) infoDe.setAttribute("aria-expanded", "false"); infoDe = null; }
  function abrirInfo(bt) {
    let t = INFO[bt.dataset.info]; if (typeof t === "function") { if (!M) return; try { t = t(M); } catch (e) { console.warn("[MercadoBoi] info:", e); return; } } if (!t) return;
    const b = $("balao-info"), tit = bt.closest(".cartao").querySelector("h2").textContent;
    b.innerHTML = "<h3>" + tit + "</h3><dl><dt>De onde vem</dt><dd>" + t.fonte + "</dd><dt>A conta</dt><dd>" + t.conta + "</dd><dt>Como ler</dt><dd>" + t.ler + "</dd></dl>";
    b.hidden = false; infoDe = bt; bt.setAttribute("aria-expanded", "true");
    const r = bt.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight, m = 8;
    b.style.left = Math.max(m, Math.min(innerWidth - w - m, r.right - w)) + "px";
    b.style.top = (r.bottom + m + h > innerHeight && r.top - m - h > 0 ? r.top - m - h : Math.min(r.bottom + m, Math.max(m, innerHeight - h - m))) + "px";
  }
  document.querySelectorAll(".cartao").forEach((c) => {
    const alvo = c.querySelector(".grafico, .corpo[id]"); if (!alvo || !INFO[alvo.id]) return;
    const bt = document.createElement("button"); bt.type = "button"; bt.className = "info"; bt.dataset.info = alvo.id; bt.textContent = "i"; bt.setAttribute("aria-label", "Sobre este gráfico"); bt.setAttribute("aria-expanded", "false");
    c.querySelector("header").appendChild(bt);
    bt.addEventListener("mouseenter", () => abrirInfo(bt)); bt.addEventListener("mouseleave", fecharInfo);
    bt.addEventListener("focus", () => abrirInfo(bt)); bt.addEventListener("blur", fecharInfo);
    bt.addEventListener("click", (e) => { e.stopPropagation(); abrirInfo(bt); });
  });
  document.addEventListener("click", (e) => { if (infoDe && !e.target.closest(".info")) fecharInfo(); });

  // ------------------------------------------------------------------ dados
  let ultimaCarga = 0;
  let D = null, M = null, atual = TELAS.indexOf(new URLSearchParams(location.search).get("tela")), carregando = false, tAtualiza = null;
  if (atual < 0) atual = 0;

  function cards() {
    const nomes = { gordo: "Valor Agro", datagro: "DATAGRO", reposicao: "Reposição", b3: "B3", cambio: "Câmbio R$", bcp: "Câmbio BCP", ypoti: "Ypoti" };
    $("cards").innerHTML = Object.keys(nomes).map((k) => { const e = window.Dados.estado[k] || { estado: "atualizando", nota: "" };
      return '<span class="card" data-estado="' + e.estado + '" title="' + String(e.nota).replace(/"/g, "&quot;") + '"><i class="luz"></i><b>' + nomes[k] + "</b>" + (e.nota ? "<span>" + e.nota + "</span>" : "") + "</span>"; }).join("");
  }

  async function carregar() {
    if (carregando) return; carregando = true;
    try {
      cards();
      const anc = D ? D.anc : await window.Dados.ancoras();
      const [gordo, ind, lotes, b3, fx, yp, cme, br] = await Promise.all([window.Dados.gordo(), window.Dados.indicador(), window.Dados.lotes(), window.Dados.b3(), window.Dados.cambio(), window.Dados.ypoti(S.ponte, S.chave), window.Dados.cme(), window.Dados.boiBr()]);
      // se uma fonte falhar numa atualização, fica o que já estava na tela
      const novo = { anc, gordo, ind, lotes, b3, fx, yp, cme, br };
      if (D && !br.hoje && D.br) novo.br = D.br;
      if (D && !(cme && cme.contratos.length)) novo.cme = D.cme;
      if (D) { if (!gordo.length) novo.gordo = D.gordo; if (!ind.length) novo.ind = D.ind; if (!lotes.length) novo.lotes = D.lotes; if (!b3.bgi.length) novo.b3 = D.b3; if (!fx.brl) novo.fx = D.fx; if (!yp.ligado && D.yp.ligado) novo.yp = D.yp; }
      D = novo; M = window.Modelo.montar(D, S);
      chaveCambio = M.cambio ? M.cambio.chave : null;
      T.cotacoes(M);
      desenharAtual(false);
      ultimaCarga = Date.now();
      $("versao").textContent = "atualizado " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " · v" + CFG.versao;
    } catch (e) {
      console.error("[MercadoBoi] carga:", e);
      $("versao").textContent = "falha ao carregar: " + (e.message || e);
    } finally { carregando = false; cards(); }
    clearTimeout(tAtualiza); tAtualiza = setTimeout(carregar, Math.max(2, +S.atualizar || 15) * 60000);
  }

  // ------------------------------------------------------------------ telas e rotação
  function desenharAtual(animar) {
    if (!M) return;
    const t = TELAS[atual];
    try { DESENHO[t](M); if (animar) { T.reanimar(t); T.contar(t); } } catch (e) { console.error("[MercadoBoi] tela " + t + ":", e); }
  }
  function ativar(i, manual) {
    atual = (i + TELAS.length) % TELAS.length; T.soltarMes(); fecharInfo();
    TELAS.forEach((t, j) => { $("tela-" + t).classList.toggle("ativa", j === atual); });
    document.querySelectorAll(".segmentado button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tela === TELAS[atual])));
    requestAnimationFrame(() => desenharAtual(true));
    if (manual !== false) agendarRotacao();
  }
  let tRot = null;
  function pararRotacao() { clearTimeout(tRot); const p = $("progresso"); p.style.transition = "none"; p.style.width = "0"; }
  function agendarRotacao() {
    pararRotacao();
    const seg = +S.rotacao || 0;
    $("rotacao-txt").textContent = seg > 0 ? "troca de tela a cada " + seg + " s" : "";
    if (!(seg > 0) || $("gaveta").classList.contains("aberta")) return;
    const p = $("progresso");
    requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transition = "width " + seg + "s linear"; p.style.width = "100%"; }));
    tRot = setTimeout(() => ativar(atual + 1), seg * 1000);
  }

  function relogio() {
    const a = new Date();
    $("relogio").textContent = a.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "") + " · " + a.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function aplicarEfeitos() { document.body.classList.toggle("leve", S.efeitos === "leves"); }

  // ------------------------------------------------------------------ eventos
  document.querySelectorAll(".segmentado button").forEach((b) => b.addEventListener("click", () => ativar(TELAS.indexOf(b.dataset.tela))));
  const telaCheia = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
  $("bt-config").addEventListener("click", () => abrirGaveta(true));
  $("bt-cheia").addEventListener("click", telaCheia);
  document.addEventListener("fullscreenchange", () => { $("bt-cheia").classList.toggle("ativo", !!document.fullscreenElement); setTimeout(() => { T.redimensionar(); desenharAtual(false); T.caberCotacoes(); }, 150); });
  $("bt-fechar").addEventListener("click", () => abrirGaveta(false));
  $("veu").addEventListener("click", () => abrirGaveta(false));
  $("form-config").addEventListener("submit", (e) => e.preventDefault());
  $("bt-salvar").addEventListener("click", () => { lerFormulario(); aplicarEfeitos(); abrirGaveta(false); carregar(); });
  $("bt-restaurar").addEventListener("click", () => { S = Object.assign({}, CFG.padroes, { ponte: S.ponte || CFG.ponte, chave: S.chave, efeitos: "completos", params: {} }); guarda.gravar("mb:cfg", S); montarFormulario(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea")) { if (e.key === "Escape") abrirGaveta(false); return; }
    const k = e.key.toLowerCase();
    if (k === "1" || k === "2" || k === "3" || k === "4") ativar(+k - 1);
    else if (k === "arrowright") ativar(atual + 1); else if (k === "arrowleft") ativar(atual - 1);
    else if (k === "c") abrirGaveta(!$("gaveta").classList.contains("aberta"));
    else if (k === "escape") { abrirGaveta(false); fecharInfo(); }
    else if (k === "r") { S.rotacao = +S.rotacao > 0 ? 0 : 45; guarda.gravar("mb:cfg", S); agendarRotacao(); }
    else if (k === "f") telaCheia();
  });
  let tParado = null;
  const mexeu = () => { document.body.classList.remove("parado"); clearTimeout(tParado); tParado = setTimeout(() => { if (!$("gaveta").classList.contains("aberta")) document.body.classList.add("parado"); }, 4000); };
  ["mousemove", "touchstart", "keydown"].forEach((ev) => document.addEventListener(ev, mexeu, { passive: true }));
  let tRes = null;
  window.addEventListener("resize", () => { clearTimeout(tRes); tRes = setTimeout(() => { T.redimensionar(); desenharAtual(false); T.caberCotacoes(); }, 200); });
  // mantém a tela acesa (TV do escritório) quando o navegador deixa
  async function acesa() { try { if (navigator.wakeLock && document.visibilityState === "visible") await navigator.wakeLock.request("screen"); } catch (e) { /* sem permissão: segue */ } }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { acesa(); if (D && Date.now() - ultimaCarga > 5 * 60000) carregar(); } });

  // ------------------------------------------------------------------ câmbio ao vivo: com o mercado aberto, confere a planilha do BCP a cada minuto
  let chaveCambio = null, olhandoCambio = false;
  async function vigiarCambio() {
    if (olhandoCambio || carregando || !D || !S.ponte || document.visibilityState !== "visible") return;
    const a = window.Modelo.agoraAssuncao();
    if (!a.util || a.min < 8 * 60 + 25 || a.min > 13 * 60 + 50) { if (M && M.cambio && M.cambio.aberto) { M = window.Modelo.montar(D, S); T.cotacoes(M); cards(); } return; }
    olhandoCambio = true;
    try {
      const linhas = await window.Dados.cambioBcp(S.ponte, S.chave);
      if (linhas) {
        const antes = M && M.cambio ? M.cambio.ult.medio : null;
        D.yp.cambioBcp = linhas; M = window.Modelo.montar(D, S); T.cotacoes(M); cards();
        if (M.cambio && M.cambio.chave !== chaveCambio) { chaveCambio = M.cambio.chave; if (TELAS[atual] === "cambio") desenharAtual(false); T.piscar(antes == null || M.cambio.ult.medio >= antes); }
      }
    } finally { olhandoCambio = false; }
  }
  setInterval(vigiarCambio, 60000);

  // ------------------------------------------------------------------ B3 ao vivo: com o pregão aberto, renova as cotações do topo a cada poucos minutos
  let olhandoB3 = false;
  async function vigiarB3() {
    if (olhandoB3 || carregando || !D || document.visibilityState !== "visible" || !window.Modelo.b3Aberta()) return;
    olhandoB3 = true;
    try { const b3 = await window.Dados.b3(); if (b3.bgi.length) { D.b3 = b3; M = window.Modelo.montar(D, S); T.cotacoes(M); cards(); } } finally { olhandoB3 = false; }
  }
  setInterval(vigiarB3, Math.max(1, +S.atualizarB3 || 2) * 60000);

  // ------------------------------------------------------------------ início
  aplicarEfeitos(); relogio(); setInterval(relogio, 20000); mexeu(); acesa();
  ativar(atual, false);
  carregar().then(agendarRotacao);
  window.MercadoBoi = { get modelo() { return M; }, get dados() { return D; }, recarregar: carregar, piscar: T.piscar };
})();

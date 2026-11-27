/**
 * Mercado do Boi — ponte de dados (Google Apps Script, app da Web).
 *
 * Serve em JSON, somente leitura, as colunas necessárias das planilhas internas
 * (compras de reposição, resultados do confinamento, matérias-primas e câmbio do BCP) para o painel
 * publicado no GitHub Pages. As planilhas continuam privadas: quem lê é a conta que
 * implanta este script. Nomes de fornecedores, facturas, guías e links não são enviados.
 *
 * Instalação (uma vez): ver apps-script/LEIAME.md no repositório.
 *   1. Colar este arquivo em um projeto novo em script.google.com e o appsscript.json no manifesto
 *      (o manifesto limita a autorização a SOMENTE LEITURA das planilhas)
 *   2. Executar a função "instalar" (gera a chave de acesso e mostra no registro)
 *   3. Implantar > Nova implantação > App da Web > Executar como: eu · Acesso: qualquer pessoa
 *
 * Chamada:  <URL do app>?k=<chave>            → todas as fontes
 *           <URL do app>?k=<chave>&fonte=compras   → só uma
 *           <URL do app>?k=<chave>&fresco=1   → ignora o cache
 */

var VERSAO = '2026-11-26d';
var CACHE_MINUTOS = 15;

var FONTES = {
  compras: {
    id: '1YRyv-fKiV0kA_H3sfKwYrpHffSmCfE6ZdacqWuq2JHs', aba: 'BD COMPRAS',
    colunas: ['FECHA', 'PROPRIETARIO', 'DEPARTAMENTO', 'ESTABLECIMENTO DE DESTINO', 'FECHA DE CHEGADA EN LA ESTANCIA', 'STATUS',
      '@antes:CANTIDAD TOTAL', 'CANTIDAD TOTAL', 'CATEGORIA', 'PRECIO LIQUIDADO', 'PESO PROMEDIO POR CABEZA SIN DESBASTE',
      'PESO PROMEDIO POR CABEZA  BASCULA', 'DESBASTE', 'COSTO POR ANIMAL', 'COSTO KG COMPRA', 'COSTO KG ESTANCIA',
      'COSTO FLETE POR ANIMAL', 'COSTO COMISIÓN POR ANIMAL', 'COSTOS TOTAL POR CABEZA (PYG)', 'CAMBIO DEL DIA',
      'COSTOS TOTAL POR KILO (PYG - con desbaste)', 'VALOR AGRO - NOVILLO DEL DIA (US)', 'AGIO PRECIO VENTA', 'RAZA'],
    obrigatoria: 'FECHA'
  },
  resultados: {
    id: '17xZ_b3XJxBIuzFNMURW6j10IwjR4tpxVdGnGYkypjWY', aba: 'BD RESULT CONF',
    colunas: ['LOTE', 'CATEGORIA', 'RAZA', 'ESTABLECIMENTO', 'SAFRA', 'DATA INICIAL', 'PESO', 'DATA FINAL', 'PESO SAÍDA', 'PESO CARCAZA',
      'GMD', 'Quantidade Abatida', 'Dias de cocho', 'Rend. Inicial', 'Rend. Final', 'CMS Médio Kg/cab/dia', 'CMS % P.V.',
      'Kg de carcaça produzidos', 'U$/Cab. Entrada', 'U$/diaria (dieta +  operacional)', 'U$/dia Alimento', 'Custo/Kg Prod.',
      'Custo Conf.', 'Custo Total U$/cab.', 'Preço Venda U$/@', 'Receita total', 'Lucro/cab Conf.', 'Lucro/cab Total',
      'Ganho em Carcaça', 'Frigorifico', 'Valor da diária', 'Boitel', 'Sistema'],
    obrigatoria: 'DATA FINAL'
  },
  milho_entregas: {
    id: '1UTd1ImU9o5oFeZn_n8oeGHchA4YEzciP-bwMRjTF3J0', aba: 'Controle de Materia Prima',
    colunas: ['FECHA RECIBIDA EN YPOTI', 'FECHA DE REMISION', 'PRODUCTO', 'COSTO ACTUAL DE MERCADO USD/TON', 'CONTRATO USD/TON',
      'CAMBIO DEL DIA', 'CONTRATO GS/TON', 'MONEDA', 'CANTIDAD S/ REMISION EN KG', 'COSTO DEL FLETE USD',
      'COSTO TON + FLETE USD + DESCARGA (FEED MANAGER)'],
    filtro: { coluna: 'PRODUCTO', contem: 'MAIZ' }
  },
  cambio_bcp: {
    id: '12Wm3awcR9lmzxyMYt5ySoZe6OcD99Uh23CIhtH_JLDY', aba: 'Intradia', cacheMinutos: 1,
    colunas: ['data', 'hora_corte', 'compra_corte', 'venda_corte', 'compra_acumulado', 'venda_acumulado', 'corte_sem_negocios', 'origem', 'capturado_em'],
    obrigatoria: 'data'
  },
  // contratos de milho seco por safra: todas as abas "Contracto/Contratos Maiz Seco <ano>" (a da safra nova entra sozinha)
  milho_contratos_safra: {
    id: '1UTd1ImU9o5oFeZn_n8oeGHchA4YEzciP-bwMRjTF3J0', abas: '^CONTRA[A-Z]*\\s+MAIZ\\s+SECO',
    colunas: ['AÑO', 'FECHA', 'PRODUCTO', 'CANTIDAD', 'PRECIO USD/TON', 'ESTADO DEL CONTRATO', 'FLETE A CARGO DE'],
    obrigatoria: 'FECHA'
  },
  milho_contratos: {
    id: '1UTd1ImU9o5oFeZn_n8oeGHchA4YEzciP-bwMRjTF3J0', aba: 'Contratos Materia Prima',
    colunas: ['ANO', 'FECHA', 'PRODUCTO', 'CANTIDAD', 'CAMBIO          Gs/$', 'PRECIO USD/TON', 'PRECIO Gs/TON', 'ESTADO DEL CONTRATO',
      'FLETE A CARGO DE'],
    filtro: { coluna: 'PRODUCTO', contem: 'MAIZ' }
  }
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  var saida;
  try {
    var chave = PropertiesService.getScriptProperties().getProperty('CHAVE');
    if (chave && p.k !== chave) {
      saida = { ok: false, erro: 'chave', mensagem: 'Chave de acesso ausente ou incorreta.' };
    } else if (p.ping) {
      saida = { ok: true, versao: VERSAO, fontes: Object.keys(FONTES) };
    } else {
      var nomes = p.fonte ? String(p.fonte).split(',') : Object.keys(FONTES);
      saida = { ok: true, versao: VERSAO, gerado: new Date().toISOString(), fontes: {} };
      for (var i = 0; i < nomes.length; i++) {
        var n = nomes[i];
        if (!FONTES[n]) continue;
        try { saida.fontes[n] = lerComCache_(n, p.fresco === '1'); }
        catch (err) { saida.fontes[n] = { erro: String(err && err.message || err) }; }
      }
    }
  } catch (err2) {
    saida = { ok: false, erro: 'interno', mensagem: String(err2 && err2.message || err2) };
  }
  return ContentService.createTextOutput(JSON.stringify(saida)).setMimeType(ContentService.MimeType.JSON);
}

/** Roda uma vez: cria a chave de acesso e confere se as planilhas abrem com esta conta. */
function instalar() {
  var props = PropertiesService.getScriptProperties();
  var chave = props.getProperty('CHAVE');
  if (!chave) { chave = Utilities.getUuid().replace(/-/g, ''); props.setProperty('CHAVE', chave); }
  Logger.log('CHAVE DE ACESSO (cole nas configurações do painel): ' + chave);
  for (var n in FONTES) {
    try { var r = ler_(n); Logger.log(n + ': ' + r.linhas.length + ' linhas, ' + r.cab.length + ' colunas' + (r.faltando.length ? ' — colunas não encontradas: ' + r.faltando.join(', ') : '')); }
    catch (err) { Logger.log(n + ': ERRO — ' + err); }
  }
}

/** Troca a chave de acesso (as telas abertas param de receber os dados da Ypoti até informar a nova). */
function trocarChave() {
  var chave = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('CHAVE', chave);
  CacheService.getScriptCache().removeAll(Object.keys(FONTES).map(function (n) { return 'mb:' + n + ':n'; }));
  Logger.log('NOVA CHAVE: ' + chave);
}

// ------------------------------------------------------------------ leitura

function norm_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function ler_(nome) {
  var f = FONTES[nome], abas = [f.aba];
  if (f.abas) {
    var re = new RegExp(f.abas);
    abas = Sheets.Spreadsheets.get(f.id, { fields: 'sheets.properties.title' }).sheets
      .map(function (x) { return x.properties.title; }).filter(function (t) { return re.test(norm_(t)); });
    if (!abas.length) throw new Error('nenhuma aba corresponde a ' + f.abas);
  }
  var linhas = [], faltando = [];
  abas.forEach(function (aba) {
    var r = lerAba_(f, aba);
    linhas = linhas.concat(r.linhas);
    r.faltando.forEach(function (c) { faltando.push(abas.length > 1 ? aba + ': ' + c : c); });
  });
  return { cab: f.colunas, linhas: linhas, faltando: faltando, abas: abas, lido: new Date().toISOString() };
}

function lerAba_(f, aba) {
  // Serviço avançado do Sheets: funciona com o escopo "somente leitura" (SpreadsheetApp.openById exigiria acesso total).
  // Números vêm crus; datas e horas vêm como aparecem na planilha (o painel sabe ler dd/mm/aaaa, 17-Nov.-26, 08:30).
  var resp = Sheets.Spreadsheets.Values.get(f.id, "'" + aba + "'", { valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' });
  var valores = resp.values || [];
  if (!valores.length) throw new Error('aba "' + aba + '" vazia ou não encontrada');
  var cab = valores[0].map(norm_);
  var idx = [], faltando = [];
  f.colunas.forEach(function (c) {
    var i = c.indexOf('@antes:') === 0 ? cab.indexOf(norm_(c.slice(7))) - 1 : cab.indexOf(norm_(c));
    idx.push(i);
    if (i < 0) faltando.push(c);
  });
  var iFiltro = f.filtro ? cab.indexOf(norm_(f.filtro.coluna)) : -1;
  var iObrig = f.obrigatoria ? cab.indexOf(norm_(f.obrigatoria)) : -1;
  var linhas = [];
  for (var r = 1; r < valores.length; r++) {
    var lin = valores[r];
    if (iObrig >= 0 && (lin[iObrig] === '' || lin[iObrig] == null)) continue;
    if (iFiltro >= 0 && norm_(lin[iFiltro]).indexOf(norm_(f.filtro.contem)) < 0) continue;
    var o = [];
    for (var k = 0; k < idx.length; k++) {
      var v = idx[k] >= 0 ? lin[idx[k]] : null;
      if (typeof v === 'number') v = Math.round(v * 1e6) / 1e6;
      else if (v === '' || v === undefined) v = null;
      o.push(v);
    }
    linhas.push(o);
  }
  return { linhas: linhas, faltando: faltando };
}

function lerComCache_(nome, fresco) {
  var cache = CacheService.getScriptCache();
  var base = 'mb:' + nome + ':';
  if (!fresco) {
    var n = cache.get(base + 'n');
    if (n) {
      var chaves = [];
      for (var i = 0; i < +n; i++) chaves.push(base + i);
      var partes = cache.getAll(chaves), txt = '', inteiro = true;
      for (var j = 0; j < +n; j++) { if (partes[base + j] == null) { inteiro = false; break; } txt += partes[base + j]; }
      if (inteiro) { var obj = JSON.parse(txt); obj.cache = true; return obj; }
    }
  }
  var dados = ler_(nome);
  try {
    var s = JSON.stringify(dados), tam = 90000, mapa = {}, total = Math.ceil(s.length / tam);
    for (var c = 0; c < total; c++) mapa[base + c] = s.substr(c * tam, tam);
    mapa[base + 'n'] = String(total);
    cache.putAll(mapa, (FONTES[nome].cacheMinutos || CACHE_MINUTOS) * 60);
  } catch (err) { /* cache é só conveniência */ }
  return dados;
}

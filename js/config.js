/* Mercado do Boi — endereços das fontes e padrões. Nada aqui é segredo (a chave da ponte fica só no navegador). */
window.MB_CONFIG = {
  versao: "2026-11-27g",
  planilhas: {
    gordo: { id: "1PSoOOJnJ2IdO6rn8fOx9Q8bTxSao6ioTN1oEbbp_qEs", aba: "Sheet1" },                 // Precios Valor Agro (raspagem diária)
    reposicao: { id: "1_UbGp17HuOGgBG5K1PZ5iEpHH0HApQAf9bCXhYwKB6Y", indicador: "INDICADOR", base: "BASE" }, // Preços de Invernada PY
  },
  // URL do app da Web (Apps Script) que lê as planilhas internas. Vazio = painel só com dados de mercado.
  ponte: "https://script.google.com/macros/s/AKfycbwEXPbndqKzwWjeixsmZdqk0Q07u_r7-qxFsQwuzc6Dbz72rT3lnpwl6K7wjWj2qsX9/exec",
  b3: "https://cotacao.b3.com.br/mds/api/v1/DerivativeQuotation/",
  cambio: "https://economia.awesomeapi.com.br/json/",
  datagro: "https://precos.api.datagro.com/dados?a=D_PEPR_SP_BR",
  dadosRapidos: "https://raw.githubusercontent.com/lucasmoller9646/mercado-boi/dados/", // cotações dos widgets e notícias (robô a cada 20 min) // Indicador do Boi DATAGRO SP: primitiva pública (último dia)
  padroes: {
    rotacao: 0,            // segundos por tela (0 = parado)
    atualizar: 15,         // minutos entre atualizações
    anos: 3,               // anos de histórico nos gráficos de série
    qmin: 0.10, qmax: 0.90, // quantis do basis sazonal
    basisAnosBoi: 0,       // anos usados no basis do boi (0 = toda a série, desde 2015)
    basisAnosMilho: 0,     // idem milho (0 = desde nov/2019)
    rcVivo: 0.50,          // rendimento para levar o gordo de carcaça a peso vivo (ágio)
    semanasNuvem: 12,      // semanas de lotes de leilão na nuvem α+β
    diasCompras: 90,       // janela das nossas compras em destaque
    lotesPreco: "rural",   // "rural" = só lotes da Rural Bioenergia no preço de venda; "todos"
    indicadores: "realizado", // "realizado" = GMD, custo etc. do mês (Resultados do Confinamento); "fixo" = planilha
    limiarPivo: 0.02,      // reversão mínima para confirmar um pico ou um vale do câmbio (2 %)
    premioSemDados: 0,     // prêmio sobre o Valor Agro quando não há venda nossa no mês (US$/kg)
    vendaManual: 0,        // nosso preço de venda informado à mão para a conta de hoje (US$/kg carcaça; 0 = usa a planilha)
    baseCompra: "vendedor", // nossas compras × indicador: "vendedor" (peso do vendedor), "balanca" (peso de balança), "posto" (custo posto fazenda ÷ balança)
    ivaCompras: 0,         // IVA embutido no nosso preço liquidado, a retirar na comparação (ex.: 0.05)
    comissaoLeilao: 0,     // comissão do comprador a somar ao preço de martelo do leilão (ex.: 0.03)
    precoReposicao: "ypoti", // lucratividade: "ypoti" = o que pagamos nas compras; "leilao" = indicador dos leilões
    custoRecria: 100,      // custo da recria com a RIP, US$/cab (apresentação Rentabilidade Histórica)
    diasRecria: 365,       // duração da recria, só para a TIR
    atualizarB3: 2,        // minutos entre atualizações das cotações da B3 com o pregão aberto
  },
};

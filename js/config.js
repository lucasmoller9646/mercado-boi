/* Mercado do Boi — endereços das fontes e padrões. Nada aqui é segredo (a chave da ponte fica só no navegador). */
window.MB_CONFIG = {
  versao: "2026-11-26a",
  planilhas: {
    gordo: { id: "1PSoOOJnJ2IdO6rn8fOx9Q8bTxSao6ioTN1oEbbp_qEs", aba: "Sheet1" },                 // Precios Valor Agro (raspagem diária)
    reposicao: { id: "1_UbGp17HuOGgBG5K1PZ5iEpHH0HApQAf9bCXhYwKB6Y", indicador: "INDICADOR", base: "BASE" }, // Preços de Invernada PY
  },
  // URL do app da Web (Apps Script) que lê as planilhas internas. Vazio = painel só com dados de mercado.
  ponte: "",
  b3: "https://cotacao.b3.com.br/mds/api/v1/DerivativeQuotation/",
  cambio: "https://economia.awesomeapi.com.br/json/",
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
    premioSemDados: 0,     // prêmio sobre o Valor Agro quando não há venda nossa no mês (US$/kg)
  },
};

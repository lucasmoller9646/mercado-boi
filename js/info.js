/* Mercado do Boi — textos da bolinha de informação de cada cartão: de onde vem o dado, que conta foi feita e como ler.
   Cada entrada pode ser um objeto ou uma função do modelo (para citar as configurações em uso). */
(function () {
  "use strict";
  const pct = (v) => Math.round(v * 100);
  const baseTxt = { vendedor: "preço por cabeça ÷ peso informado pelo vendedor", balanca: "preço por cabeça ÷ peso de balança na chegada", posto: "custo posto fazenda (animal + frete + comissão) ÷ peso de balança" };

  window.MB_INFO = {
    // ------------------------------------------------------------ boi gordo e milho
    "g-boi-serie": {
      fonte: "Paraguai: novillo do Valor Agro, raspado todo dia para a planilha “Precios Valor Agro”; antes do início da raspagem, a série da planilha Correlación. Brasil: até maio de 2026, a série âncora da planilha Correlación; daí em diante, o Indicador do Boi DATAGRO SP (primitiva pública, guardada dia a dia pelo robô do repositório), em R$/@ ÷ 15 kg ÷ dólar comercial do dia. Ypoti: Resultados do Confinamento.",
      conta: "Tudo em US$ por kg de carcaça. A linha da Ypoti é o preço médio do mês, ponderado pelas cabeças abatidas (por padrão, só lotes da Rural Bioenergia).",
      ler: "A distância entre a linha azul e a verde é o basis do Paraguai sobre o Brasil. A laranja acima da azul quer dizer que vendemos com prêmio sobre o mercado.",
    },
    "g-boi-basis": (M) => ({
      fonte: "Mesmas séries diárias de Paraguai e Brasil do gráfico ao lado, desde 2015.",
      conta: "Basis = preço do Paraguai ÷ preço do Brasil − 1, dia a dia. Para cada mês do ano, a faixa vai do percentil " + pct(M.S.qmin) + " ao " + pct(M.S.qmax) + " de todos os anos e a linha tracejada é a mediana. A linha azul é o ano corrente; o mês atual usa o Valor Agro de hoje contra o primeiro vencimento do BGI.",
      ler: "Mostra em que época do ano o Paraguai costuma valer mais ou menos que o Brasil. Ano corrente perto do topo da faixa: o Paraguai está caro em relação ao padrão histórico; perto da base, barato.",
    }),
    "g-boi-curva": (M) => ({
      fonte: "Contratos futuros de boi gordo (BGI) e de dólar (DOL) da B3, com atraso de 15 minutos. Sem negócio no dia, vale o ajuste do pregão anterior.",
      conta: "R$/@ ÷ 15 kg ÷ dólar futuro do mesmo vencimento = US$/kg no Brasil. Para trazer ao Paraguai, aplica-se o basis histórico do mês do vencimento: mediana (linha tracejada) e faixa entre os percentis " + pct(M.S.qmin) + " e " + pct(M.S.qmax) + ".",
      ler: "É o preço que o mercado futuro “enxerga” para o novillo paraguaio em cada mês. As linhas horizontais mostram onde estão hoje o Valor Agro e a nossa venda, para comparar com o que vem pela frente.",
    }),
    "g-milho-serie": {
      fonte: "Paraguai interno e CCM à vista: série semanal do relatório da StoneX (até onde o relatório alcança). Ponto verde: primeiro vencimento do CCM hoje, na B3. Ypoti: contratos de milho seco das planilhas de matéria-prima, pela data do contrato.",
      conta: "Tudo em US$ por tonelada. CCM: R$/saca ÷ 60 kg × 1.000 ÷ dólar. A linha da Ypoti é a média do mês ponderada pelas toneladas contratadas.",
      ler: "A distância entre o Paraguai e a B3 é o basis do milho. A linha laranja mostra se compramos acima ou abaixo do mercado interno em cada mês.",
    },
    "g-milho-basis": (M) => ({
      fonte: "Série semanal da StoneX (Paraguai interno menos CCM), desde novembro de 2019; o trecho mais recente foi lido do gráfico do relatório, com erro de até uns US$ 5/t.",
      conta: "Basis = milho no Paraguai − CCM na B3, em US$/t. Faixa entre os percentis " + pct(M.S.qmin) + " e " + pct(M.S.qmax) + " de cada mês do ano; tracejado = mediana. O ponto laranja é o nosso basis hoje: preço das nossas compras recentes menos o primeiro vencimento do CCM.",
      ler: "O basis do milho paraguaio é negativo (desconto sobre a B3) e mais fundo na safra. Ponto laranja abaixo da faixa: compramos melhor que o padrão do mês.",
    }),
    "g-milho-curva": (M) => ({
      fonte: "Contratos futuros de milho da B3 (CCM) e dólar futuro (DOL), com atraso de 15 minutos. Chicago: contratos de milho da CME, atualizados algumas vezes por dia.",
      conta: "B3: R$/saca ÷ 60 × 1.000 ÷ dólar futuro = US$/t; mais o basis histórico do mês (mediana e faixa P" + pct(M.S.qmin) + "–P" + pct(M.S.qmax) + ") = milho posto no Paraguai. Chicago: centavos de dólar por bushel × 0,39368 = US$/t.",
      ler: "Mostra para onde o mercado aponta o milho paraguaio nos próximos meses. Chicago serve de referência internacional: quando sobe e a B3 não acompanha, o prêmio brasileiro está encolhendo.",
    }),

    // ------------------------------------------------------------ reposição
    "g-repo-pesos": {
      fonte: "Planilha “Preços de Invernada PY”: lotes raspados dos remates (Everdem, Tropeando, Invernada e outros) na aba BASE e o indicador semanal na aba INDICADOR.",
      conta: "As linhas são o indicador semanal para o macho de 180, 230, 300 e 360 kg, saído do ajuste α + β · peso da semana. Cada bolinha é um lote de machos vendido em leilão: a cor é a fonte e o tamanho, o número de cabeças.",
      ler: "Passe o mouse numa bolinha para ver o negócio (feira, lote, categoria, cabeças, peso, preço, departamento, observações); clique para abrir a página da fonte. Animal mais leve vale mais por quilo: por isso a linha de 180 kg fica acima da de 360 kg.",
    },
    "g-repo-agio": (M) => ({
      fonte: "Indicador semanal dos leilões, novillo do Valor Agro e câmbio do dia. Linha laranja: nossas compras de machos (BD Compras).",
      conta: "Ágio = preço do kg vivo da reposição ÷ preço do kg vivo do gordo − 1. O gordo vem de carcaça para peso vivo com rendimento de " + pct(M.S.rcVivo) + "%.",
      ler: "Quanto o quilo do bezerro custa a mais que o quilo do boi pronto. Ágio alto aperta a margem de quem recria e engorda; ágio baixo é hora boa de repor.",
    }),
    "g-repo-nuvem": (M) => ({
      fonte: "Lotes de leilão das últimas " + M.S.semanasNuvem + " semanas (aba BASE) e nossas compras dos últimos " + M.S.diasCompras + " dias.",
      conta: "Reta: valor por cabeça = α + β · peso, como no indicador da planilha (cada lote pesa igual). Curva de 2º grau (violeta): valor por cabeça = β · (k · peso + c + d · peso²), com o mesmo β da semana e a mesma correção de fonte; k, c e d saem dos lotes de machos das 104 semanas anteriores (156 se houver menos de 250 lotes): com menos lotes a curvatura fica instável. A tracejada branca é a reta ponderada pelas cabeças de cada lote.",
      ler: "À esquerda, valor por cabeça; à direita, o mesmo em preço por quilo. Onde a curva se afasta da reta, a reta erra o preço naquele peso. Bolinha laranja abaixo das linhas: compramos mais barato que o mercado naquele peso.",
    }),
    "g-repo-alfa": {
      fonte: "Aba INDICADOR da planilha de reposição: α estimado toda semana com os lotes dos leilões, um para macho e outro para fêmea.",
      conta: "α = β × c, em milhões de Gs por cabeça. É a parte do preço que não depende do peso.",
      ler: "α é o “serviço da vaca”: o que se paga pelo bezerro existir. Sobe quando falta bezerro no mercado, mesmo com o quilo (β) parado.",
    },
    "g-repo-beta": {
      fonte: "β da reta: aba INDICADOR. Curva em 180 e 360 kg: régua de 2º grau calculada no painel com os lotes da aba BASE (a mesma conta está na aba REGUA_2_GRAU da planilha).",
      conta: "Na reta, o quilo a mais vale β em qualquer peso. Na curva, o quilo a mais vale a derivada do valor por cabeça: β · (k + 2 · d · peso), calculada em 180 e em 360 kg.",
      ler: "Se a linha de 180 kg fica acima da de 360 kg, o quilo a mais vale mais no animal leve: o mercado paga mais por ganho no bezerro do que no toretón, e vice-versa. Na reta as duas seriam iguais a β.",
    },
    "g-repo-razao": {
      fonte: "Régua de 2º grau (linhas cheias) e régua da planilha (tracejadas), semana a semana.",
      conta: "Valor do kg a mais ÷ preço do kg do animal, no mesmo peso: β(peso) ÷ p(peso). Na reta é peso ÷ (peso + c). Em economia é a elasticidade do valor do animal ao peso; na literatura americana, o “value of gain” dividido pelo preço do bezerro.",
      ler: "Mostra quanto de dinheiro cada kg produzido traz para cada guarani imobilizado em um kg do animal. 60% em 180 kg quer dizer que o kg engordado vale 60% do que custou cada kg do bezerro comprado: o resto do preço é o ágio por ele existir (α). Multiplicado pelo ganho diário ÷ peso, vira o retorno bruto diário sobre o capital do animal.",
    },
    "g-lucro-serie": (M) => ({
      fonte: "Mesmo método da apresentação Rentabilidade Histórica, refeito mês a mês: preços de compra da Ypoti (BD COMPRAS), venda, pesos, dias, diária e rendimento dos lotes abatidos (BD RESULT CONF), câmbio do mês.",
      conta: "Recria (com a RIP): peso de entrada no confinamento × preço do toretón − 180 kg × preço do desmamante, tudo ÷ câmbio, menos US$ " + (M.lucro.PY.custoRecria) + " por cabeça. Confinamento: peso de saída × rendimento × preço do gordo − dias × diária − peso de entrada × preço do toretón ÷ câmbio. Sem juros, quebra nem mortalidade, como na conta manual. A TIR de cada etapa é (receita ÷ desembolso) elevado a 365 ÷ dias − 1; a do ciclo sai do fluxo de caixa.",
      ler: "Use os botões para ver em dólares por cabeça ou em TIR ao ano. Clique num mês para fixá-lo: a tabela ao lado passa a mostrar a conta daquele mês. O preço do toretón divide o lucro entre as etapas; o ciclo completo não depende dele.",
    }),
    "g-lucro-oper": {
      fonte: "Planilha de resultados do confinamento (BD RESULT CONF), lotes da Rural Bioenergia, por mês de abate.",
      conta: "Médias do mês ponderadas pelas cabeças: custo de entrada do animal (U$/Cab. Entrada), custo do confinamento (Custo Conf.) e receita total. No modo “a mercado”, a compra vira peso de entrada × preço do toretón do mês ÷ câmbio.",
      ler: "A linha branca acima das áreas é margem; abaixo, prejuízo. O custo real de entrada mostra o resultado contábil do confinamento; a mercado, quanto o confinamento ganha se tivesse comprado o boi magro no dia.",
    },
    "g-lucro-sens": {
      fonte: "Mesmo cálculo da conta de hoje (ou do mês fixado).",
      conta: "Refaz o lucro do ciclo para sete preços do gordo (de −0,60 a +0,60 US$/kg) e sete preços do desmamante (de −15% a +15%).",
      ler: "A célula com borda branca é a situação atual. Andar para a direita é o gordo subir; para cima, o desmamante encarecer. O verde mostra onde ainda há lucro.",
    },
    "conta-lucro": {
      fonte: "Apresentação Rentabilidade Histórica (conta manual), com os dados mais recentes.",
      conta: "A recria compra o desmamante de 180 kg e entrega o toretón no peso de entrada do confinamento; o confinamento compra esse toretón ao preço de mercado e vende o gordo. No ciclo, a passagem interna se cancela.",
      ler: "A coluna Ciclo é a operação inteira. A segunda tabela mostra os preços e a zootecnia que entraram; com um mês fixado no gráfico, aparece a coluna daquele mês ao lado da de hoje.",
    },

    // ------------------------------------------------------------ câmbio
    "g-cambio-hist": (M) => ({
      fonte: "Câmbio referencial do BCP (mercado flutuante com clientes não financeiros), raspado a cada corte de 30 minutos para a planilha “Câmbio BCP USD-PYG intradiário”.",
      conta: "Cada vela é um dia: abertura, máxima, mínima e fechamento do preço médio entre compra e venda. Médias móveis de 10 e 50 pregões. Pico ou vale confirmado depois de uma reversão de " + ((M.S.limiarPivo || 0.02) * 100).toFixed(1).replace(".", ",") + "%. O leque à direita é a projeção: tendência recente amortecida mais a oscilação diária dos últimos 60 pregões; a faixa escura cobre 50% dos casos e a clara, 80%.",
      ler: "Vela verde: o dólar subiu no dia; vermelha: caiu. Média curta acima da longa indica tendência de alta. O último pico confirmado funciona como resistência e o último vale, como suporte. A projeção não é previsão: diz onde o dólar tende a estar se continuar se comportando como nos últimos meses.",
    }),
    "g-cambio-termo": {
      fonte: "Fechamentos diários do dólar do BCP.",
      conta: "Sete métodos dão cada um uma nota de −2 (forte queda do dólar) a +2 (forte alta): médias de 10 e 50, variação de 20 e de 60 pregões, MACD e picos e vales (seguidores de tendência); IFR e bandas de Bollinger (osciladores). O ponteiro é a média das notas.",
      ler: "Seguidores de tendência dizem para onde o dólar está indo. Osciladores fazem a leitura contrária: se subiu depressa demais, apontam queda. Quando os dois grupos discordam, o movimento pode estar perto de uma pausa. No estudo deste par, os seguidores de tendência funcionaram e os osciladores não.",
    },
    "g-cambio-dia": {
      fonte: "Cortes de 30 minutos do BCP, de hoje e dos últimos 60 pregões.",
      conta: "Linhas cheias: compra e venda de hoje. Faixa cinza: o dia típico, isto é, a mediana de quanto a compra e a venda de cada horário ficam acima ou abaixo da média do próprio dia, aplicada sobre a média de hoje. A distância entre as duas linhas é o spread.",
      ler: "Quem vende dólar recebe a cotação de compra: a melhor hora é quando a borda de baixo da faixa está mais alta e a faixa mais estreita. Quem compra dólar paga a de venda: melhor quando a borda de cima está mais baixa. A linha tracejada vertical marca a melhor hora típica para vender.",
    },
    "g-cambio-ifr": {
      fonte: "Fechamentos diários do dólar do BCP.",
      conta: "Índice de Força Relativa de 14 pregões (método de Wilder): compara o tamanho médio das altas com o das quedas e devolve um número de 0 a 100.",
      ler: "Acima de 70 (faixa vermelha) o dólar subiu rápido demais e a leitura clássica é de correção para baixo, não de que vai subir mais. Abaixo de 30 (faixa verde) caiu rápido demais e costuma repicar. No meio, sem exagero. Neste par o IFR sozinho não deu resultado: serve de alerta, não de gatilho.",
    },
    "tecnica-cambio": {
      fonte: "Mesmos fechamentos diários do BCP.",
      conta: "Projeção: mediana e faixas de 50% e 80% de confiança para 21 pregões (cerca de 30 dias) e 42 pregões (cerca de 60 dias). Níveis: último pico e último vale confirmados, médias móveis e variação acumulada.",
      ler: "Faixa de 80% quer dizer: se o dólar seguir oscilando como nos últimos 60 pregões, em 8 de cada 10 casos ele termina dentro dela. Quanto mais longe no tempo, mais larga a faixa.",
    },
  };
})();

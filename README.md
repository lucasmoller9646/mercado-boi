# Mercado do Boi · Ypoti

Painel de mercado para a TV do escritório: boi gordo, milho, reposição, lucratividade da operação e câmbio, em quatro telas que
podem girar sozinhas. Página estática (GitHub Pages), sem servidor próprio.

**Endereço:** <https://lucasmoller9646.github.io/mercado-boi/>

## As quatro telas

| Tela | O que mostra |
|---|---|
| **Boi gordo e milho** | Novillo Paraguai (Valor Agro) × Brasil × o nosso preço de venda; basis sazonal do boi; curva do BGI em dólar corrigida pelo basis do mês de vencimento (faixa entre os quantis); milho Paraguai interno × CCM B3 × as nossas compras; basis sazonal do milho; curva do CCM corrigida pelo basis. |
| **Reposição** | Indicador semanal por peso (180, 230, 300 e 360 kg); ágio da reposição sobre o gordo; α (serviço da vaca) e β (quilo produzido) no tempo; a nuvem de lotes de leilão com as retas α + β·peso e as nossas compras por cima; desvio mensal das nossas compras contra o indicador. |
| **Lucratividade** | Motor da planilha *Rentabilidade do Invernista* (recria a pasto → RIP → confinamento → ciclo completo, com TIR), alimentado pelo bezerro de 180 kg, pelo toretón de 360 kg, pelo nosso preço do gordo e pelos indicadores do mês em *Resultados do Confinamento*; série mês a mês, ponto de equilíbrio e sensibilidade. |

| **Câmbio** | Dólar em guaranis do BCP (mercado flutuante, cortes de 30 min) com a cotação de compra e venda piscando enquanto o mercado está aberto; velas diárias com médias de 10 e 50 dias, picos e vales (zigue-zague), suporte e resistência; o dia corte a corte; spread mediano por horário (quando converter); IFR de 14 dias. |

## De onde vêm os dados

| Fonte | Como chega | Atualização |
|---|---|---|
| Valor Agro (planilha *Precios Valor Agro*) | direto da planilha compartilhada por link | a cada carga da página |
| Reposição (planilha *Preços de Invernada PY*, abas INDICADOR e BASE) | idem | idem |
| B3: BGI, CCM e DOL | `cotacao.b3.com.br` (cotação com atraso de 15 min; sem negócio no dia, vale o ajuste anterior) | idem |
| Câmbio R$ e Gs | `economia.awesomeapi.com.br` | idem |
| Compras, vendas do confinamento e milho da Ypoti | ponte em Google Apps Script ([`apps-script/`](apps-script/LEIAME.md)) | cache de 15 min |
| Câmbio BCP USD/PYG intradiário (planilha alimentada pelo script de coleta a cada 10 min) | mesma ponte | cache de 1 min; com o mercado aberto (08:25–13:40 de Assunção) o painel confere a cada minuto |
| Série âncora do boi Paraguai × Brasil, 2015–mai/2026 | `data/boi_ancora.json` (planilha *Correlación*) | fixa |
| Milho Paraguai interno × CCM B3, nov/2019–jul/2026 | `data/milho_ancora.json` (apresentação StoneX de jul/2026) | fixa |

Sem a ponte o painel funciona com tudo que é de mercado; os quadros da Ypoti avisam que estão esperando os dados e a
lucratividade usa o Valor Agro como preço do gordo e os indicadores fixos da planilha.

## Contas

- **Basis do boi** = Paraguai ÷ Brasil − 1, em dólar por kg de carcaça. **Basis do milho** = Paraguai interno − B3, em dólar por tonelada.
  Para cada mês do ano calculam-se os quantis (padrão 10 % e 90 %, ajustáveis) e a mediana.
- **Curvas futuras:** BGI em R$/@ ÷ 15 ÷ dólar futuro do vencimento (curva do DOL) = US$/kg; CCM em R$/saca ÷ 60 × 1000 ÷ dólar = US$/t.
  O equivalente Paraguai aplica o basis do mês de vencimento.
- **Ágio** = (Gs/kg da reposição ÷ câmbio) ÷ (novillo Valor Agro × rendimento de 50 %) − 1.
- **α e β:** vêm da aba INDICADOR (metodologia na própria planilha): preço por kg = β · (1 + c ÷ peso), com α = β · c.
  O desvio de cada compra nossa é ln(preço pago ÷ preço do indicador no peso e sexo do lote, na semana da compra).
- **Câmbio:** o preço de cada corte é a média entre compra e venda; a vela do dia usa os cortes com negócio (o das 08:30 repete o fechamento anterior e fica de fora).
  Tendência = média de 10 dias contra a de 50; pico ou vale é confirmado depois de uma reversão de 2 % (ajustável). Quando o câmbio do BCP está disponível, é a
  média acumulada do dia (compra e venda) que converte guaranis em dólar no painel inteiro.
- **Lucratividade:** `js/calc.js` reproduz célula a célula a aba *Recria e Engorda* (conferência em `tools/teste_calc.js`).
  O toretón gordo sai do toretón de 360 kg pela mesma proporção da planilha (18.500 ÷ 19.000). Os indicadores “de hoje” são a
  média ponderada dos três últimos meses fechados com abate; na série, meses sem abate são interpolados.

## Usar na TV

- `?rotacao=45` no endereço liga a troca de tela a cada 45 segundos (fica guardado no navegador).
- `#k=<chave>` no fim do endereço grava a chave da ponte no navegador e some da barra (o que vem depois do `#` não é enviado a servidor nenhum).
- Teclas: **1 2 3 4** telas · **← →** · **R** rotação · **F** tela cheia · **C** configurações.
- A engrenagem das configurações só aparece quando se mexe o mouse.

## Manutenção

```
node tools/teste_calc.js                      # confere o motor contra a planilha
cd tools && npm i echarts@5.5.0 playwright && node teste_painel.js   # sobe o painel com fontes simuladas e tira capturas
python3 tools/extrair_ancoras.py <Correlación.xlsx> <pagina46.svg> <basis.jpg> data   # refaz as séries âncora
```

Ao publicar uma versão nova, troque `versao` em `js/config.js` e o `?v=` dos arquivos em `index.html`.

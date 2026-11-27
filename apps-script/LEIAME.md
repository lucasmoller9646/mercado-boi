# Ponte de dados (Google Apps Script)

O painel roda no GitHub Pages e lê sozinho o que é público (Valor Agro, indicador de reposição, B3 e câmbio).
As três planilhas internas — **COMPRAS DE DESMAMANTES**, **RESULTADOS CONFINAMENTO** e **CONTROL DE MATERIAS PRIMAS** —
são privadas, e um site estático não consegue abri-las. Este script faz a ponte: roda na conta Google de quem o
implanta, lê só as colunas necessárias e devolve JSON protegido por uma chave. Nomes de fornecedores, facturas,
guías e links **não** são enviados.

## Instalar (uma vez, cerca de três minutos)

1. Abra <https://script.google.com> com a conta que enxerga as três planilhas e clique em **Novo projeto**.
2. Apague o conteúdo de `Código.gs`, cole o arquivo [`Codigo.gs`](Codigo.gs) deste repositório e salve. Dê ao projeto o nome *Mercado do Boi — ponte*.
3. No seletor de funções escolha **instalar** e clique em **Executar**. Autorize o acesso (ler planilhas). No
   *Registro de execução* aparece a **chave de acesso** e, para cada planilha, quantas linhas foram lidas.
4. **Implantar › Nova implantação › App da Web**. *Executar como:* **Eu**. *Quem pode acessar:* **Qualquer pessoa**. Copie a URL que termina em `/exec`.
5. No painel, tecla **C** (Configurações) › *Dados da Ypoti*: cole a URL e a chave e clique em **Salvar e atualizar**.
   Para não repetir em cada aparelho, abra uma vez `…/mercado-boi/?ponte=<URL>&k=<chave>`: a página guarda os dois
   no navegador e limpa a barra de endereço.

A URL pode ficar gravada em `js/config.js` (campo `ponte`) — ela não é segredo. A **chave não vai para o repositório**.

## Atualizar o script

Colar a versão nova, salvar e **Implantar › Gerenciar implantações › ✏️ › Versão: Nova versão › Implantar**
(a URL não muda). O script só precisa mudar quando o painel passar a pedir uma coluna nova das planilhas.

## Trocar a chave

Executar a função **trocarChave** e informar a nova chave nas configurações do painel.

## Teste rápido

`<URL>?k=<chave>&ping=1` responde `{"ok":true,"versao":"…","fontes":[…]}`. Sem a chave: `{"ok":false,"erro":"chave"}`.
As leituras ficam 15 minutos em cache; `&fresco=1` força ler de novo.

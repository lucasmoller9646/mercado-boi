# Mercado do Boi no Ypoti Campo (APK e App Store) com widgets

Pacote para aplicar no repositório `ypoti-ganaderia/ypoti-campo` (Expo SDK 58). Os arquivos de `ypoti-campo/` vão para os mesmos caminhos lá.

**Nada disto foi compilado nem testado em aparelho:** o ambiente em que foi escrito não tem Xcode nem build do Android, e o repositório do app estava só para leitura. As APIs seguem a documentação oficial do SDK 58 (`expo-widgets`) e do `@bacons/apple-targets`; confira com `npx tsc --noEmit`, `npx expo lint` e um build de desenvolvimento antes de publicar.

## O que tem aqui

| Peça | Onde | Sai por |
|---|---|---|
| Módulo "Mercado do Boi" (abre o painel em versão de celular) | `src/modulos/mercado/index.tsx` + uma linha em `src/modulos/registro.ts` | atualização automática (OTA) |
| Widget do iPhone: tela de início (pequeno, médio, grande) e tela de bloqueio | `src/widgets/MercadoBoi.ios.tsx` | build novo nas lojas |
| Widget do Android: tela de início | `src/widgets/MercadoBoi.android.tsx` | build novo |
| Busca das cotações e entrega aos widgets | `src/widgets/cotacoes.ts`, `src/widgets/atualizar.ts` | build novo |
| Complicação do Apple Watch | `targets/relogio/` | build novo |

## Dados

Os widgets leem `https://raw.githubusercontent.com/lucasmoller9646/mercado-boi/dados/cotacoes.json`, que o robô do mercado-boi (`.github/workflows/dados.yml`, a cada 20 minutos) monta com dados públicos: Valor Agro, Indicador do Boi DATAGRO, indicador de reposição 180 kg, BGI e CCM da B3, milho em Chicago, dólar comercial e o câmbio do BCP. O BCP chega pela ponte do Apps Script no modo público (`?publico=cambio`), que devolve só data, hora, compra, venda e acumulado do dia dos últimos cortes; nenhuma chave vai para o app.

## Passo a passo

1. **Painel no domínio do app.** O Ypoti Campo só abre por dentro endereços de `ypoti.com/apps/`. Acrescentar `mercado-boi` em `~/apps-repos.txt` na hospedagem (o `apps-sync.sh` clona em `public_html/apps/mercado-boi`). A página `ypoti.com/apps/mercado/` atual mostra o painel do GitHub num quadro, e dentro do quadro o navegador guarda a chave à parte; o módulo deve apontar para a cópia direta.
2. **Módulo.** Copiar `src/modulos/mercado/index.tsx` e acrescentar `mercado` à lista em `src/modulos/registro.ts`. Sai por OTA; o administrador habilita no módulo Usuarios.
3. **Widgets do iPhone e do Android.**
   ```bash
   npx expo install expo-widgets @expo/ui
   ```
   No `app.json`, em `plugins`:
   ```json
   ["expo-widgets", {
     "enableAndroid": true,
     "widgets": [{
       "name": "MercadoBoi",
       "displayName": "Mercado do Boi",
       "description": "Câmbio do BCP, boi gordo, bezerro, B3 e Chicago",
       "ios": { "supportedFamilies": ["systemSmall", "systemMedium", "systemLarge", "accessoryRectangular", "accessoryInline", "accessoryCircular"] },
       "android": { "targetCellWidth": 4, "targetCellHeight": 2, "resizeMode": "both" }
     }]
   }]
   ```
   Copiar `src/widgets/`. Chamar `atualizarWidgets()` ao abrir o app e dentro da tarefa de fundo que já existe (`src/nucleo/fondo.ts`, função da `TAREA_SYNC`, antes do `return`): `await atualizarWidgets().catch(() => {});`. O sistema roda essa tarefa a cada 15 minutos ou mais; no iPhone, a frequência real é decidida pelo iOS (bateria, uso do app).
4. **Apple Watch.**
   ```bash
   npx expo install @bacons/apple-targets
   npx create-target watch          # app do relógio (exigido pela Apple para hospedar a complicação)
   ```
   Pôr a pasta `targets/relogio/` (tipo `watch-widget`) e o plugin `"@bacons/apple-targets"` em `plugins`; definir `ios.appleTeamId` no `app.json`. A complicação busca o arquivo sozinha (URLSession) a cada 20 minutos, dentro do orçamento do watchOS. Famílias: retangular (câmbio, boi e bezerro), circular e de canto (câmbio), em linha (câmbio e boi).
5. **Build.** Widgets e relógio mexem na parte nativa: a impressão digital do runtime muda e a atualização OTA não chega aos instaladores antigos. É preciso `eas build` para Android e iOS e enviar às lojas.

## Celular sem o app

O painel também funciona como app da web: no celular, abrir `ypoti.com/apps/mercado-boi/` e usar "Adicionar à tela de início". Abas embaixo, deslizar o dedo troca de tela, notícias do câmbio em lista.

/** Complicação do Apple Watch (@bacons/apple-targets). O Apple Watch exige um app de relógio que contenha a complicação:
 *  crie também o alvo "watch" com `npx create-target watch` e ponha esta extensão dentro dele (ver app-movel/LEIA-ME.md). */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch-widget',
  name: 'Mercado do Boi',
  bundleIdentifier: '.relogio.complicacao',
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
});

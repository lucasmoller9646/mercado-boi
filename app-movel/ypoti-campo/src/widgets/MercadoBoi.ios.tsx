import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { PropsWidget } from './cotacoes';

/**
 * Widget do iPhone (tela de início e tela de bloqueio). O runtime dos widgets não busca dados nem importa
 * funções: as linhas chegam prontas pelo updateSnapshot (src/widgets/atualizar.ts).
 * Pequeno: câmbio e boi. Médio: as seis primeiras cotações. Tela de bloqueio: câmbio (retangular) ou boi (em linha).
 */
const MercadoBoi = (props: PropsWidget, environment: WidgetEnvironment) => {
  'widget';
  const fundo = containerBackground('#06130C', 'widget');
  const cor = (sobe: boolean | null) => (sobe == null ? '#BFCDC4' : sobe ? '#3FCF63' : '#F0806A');
  const linhas = props.linhas || [];

  if (environment.widgetFamily === 'accessoryInline') {
    const b = linhas.find((l) => l.rot === 'Boi PY') || linhas[0];
    return <Text>{b ? b.rot + ' ' + b.valor + ' ' + b.variacao : 'Mercado do Boi'}</Text>;
  }
  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1}>
        {linhas.slice(0, 3).map((l) => (
          <HStack spacing={4} key={l.rot}>
            <Text modifiers={[font({ size: 12 })]}>{l.rot}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>{l.valor}</Text>
          </HStack>
        ))}
      </VStack>
    );
  }
  if (environment.widgetFamily === 'accessoryCircular') {
    const c = linhas[0];
    return (
      <VStack spacing={0}>
        <Text modifiers={[font({ size: 9 })]}>Gs/US$</Text>
        <Text modifiers={[font({ size: 13, weight: 'bold' })]}>{c ? c.valor.split(' · ')[0] : '–'}</Text>
      </VStack>
    );
  }

  const n = environment.widgetFamily === 'systemSmall' ? 2 : environment.widgetFamily === 'systemMedium' ? 6 : 8;
  return (
    <VStack alignment="leading" spacing={environment.widgetFamily === 'systemSmall' ? 6 : 3} modifiers={[fundo]}>
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle({ type: 'color', color: '#E76624' })]}>MERCADO DO BOI</Text>
        <Spacer />
        <Text modifiers={[font({ size: 10 }), foregroundStyle({ type: 'color', color: '#8FA597' })]}>{props.atualizado}</Text>
      </HStack>
      {linhas.slice(0, n).map((l) => (
        <HStack spacing={6} key={l.rot}>
          <Text modifiers={[font({ size: 12 }), foregroundStyle({ type: 'color', color: '#BFCDC4' })]}>{l.rot}</Text>
          <Spacer />
          <Text modifiers={[font({ size: environment.widgetFamily === 'systemSmall' ? 17 : 14, weight: 'semibold' }), foregroundStyle({ type: 'color', color: '#EAF2EC' })]}>{l.valor}</Text>
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle({ type: 'color', color: cor(l.sobe) })]}>{l.variacao}</Text>
        </HStack>
      ))}
    </VStack>
  );
};

export default createWidget('MercadoBoi', MercadoBoi, { atualizado: '', linhas: [] });

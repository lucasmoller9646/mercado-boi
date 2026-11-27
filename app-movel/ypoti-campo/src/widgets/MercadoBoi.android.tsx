import { Column, Row, Text } from '@expo/ui/jetpack-compose';
import { createWidget } from 'expo-widgets';
import type { PropsWidget } from './cotacoes';

/**
 * Widget da tela de início do Android (Jetpack Compose). Mesmos dados do widget do iPhone,
 * entregues pelo updateSnapshot (src/widgets/atualizar.ts). No Android não há linha do tempo:
 * o widget mostra o último retrato até a próxima atualização.
 */
const MercadoBoi = (props: PropsWidget) => {
  'widget';
  const linhas = props.linhas || [];
  return (
    <Column>
      <Text>{'Mercado do Boi · ' + props.atualizado}</Text>
      {linhas.slice(0, 6).map((l) => (
        <Row key={l.rot}>
          <Text>{l.rot + '  ' + l.valor + '  ' + l.variacao}</Text>
        </Row>
      ))}
    </Column>
  );
};

export default createWidget('MercadoBoi', MercadoBoi, { atualizado: '', linhas: [] });

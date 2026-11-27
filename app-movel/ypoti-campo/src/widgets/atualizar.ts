import MercadoBoi from './MercadoBoi';
import { buscarCotacoes } from './cotacoes';

/**
 * Busca as cotações e entrega aos widgets. Chamar:
 *  - ao abrir o app (src/app/_layout.tsx ou a tela de início), e
 *  - dentro da tarefa de fundo que já existe (src/nucleo/fondo.ts, TAREA_SYNC), que o sistema roda
 *    a cada 15 minutos ou mais, com bateria e rede.
 * Falha em silêncio: sem rede, o widget segue com o último retrato.
 */
export async function atualizarWidgets(): Promise<void> {
  const props = await buscarCotacoes();
  if (!props) return;
  try {
    MercadoBoi.updateSnapshot(props);
  } catch {
    // widget ainda não adicionado ou plataforma sem suporte: nada a fazer
  }
}

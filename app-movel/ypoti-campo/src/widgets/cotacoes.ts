/**
 * Cotações para os widgets: o robô do repositório mercado-boi grava este arquivo a cada 20 minutos
 * (ramo "dados"). Só dados públicos de mercado; nenhuma chave.
 */
export const URL_COTACOES = 'https://raw.githubusercontent.com/lucasmoller9646/mercado-boi/dados/cotacoes.json';

export interface Cotacao {
  id: string;
  rot: string;
  val: number | null;
  val2?: number | null;
  dec: number;
  un: string;
  var: number | null;
  quando?: string | null;
  antigo?: boolean;
}

/** O que cada widget recebe: só texto já formatado (o runtime dos widgets não roda funções de formatação). */
export interface PropsWidget {
  atualizado: string;
  linhas: { rot: string; valor: string; variacao: string; sobe: boolean | null }[];
}

const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export function formatar(c: Cotacao): PropsWidget['linhas'][number] {
  const valor = c.val == null ? '–' : nf(c.dec).format(c.val) + (c.val2 != null ? ' · ' + nf(c.dec).format(c.val2) : '');
  const v = c.var;
  return {
    rot: c.rot,
    valor,
    variacao: v == null ? '' : (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '• ') + nf(Math.abs(v) < 0.001 ? 2 : 1).format(Math.abs(v) * 100) + '%',
    sobe: v == null || Math.abs(v) < 5e-5 ? null : v > 0,
  };
}

/** Busca as cotações e devolve as linhas na ordem dos widgets (câmbio e boi primeiro). */
export async function buscarCotacoes(): Promise<PropsWidget | null> {
  try {
    const r = await fetch(URL_COTACOES + '?t=' + Math.floor(Date.now() / 300000), { headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) return null;
    const j = (await r.json()) as { atualizado: string; itens: Cotacao[] };
    const ordem = ['pyg', 'boi', 'boisp', 'bezerro', 'bgi', 'ccm', 'cme', 'brl'];
    const itens = [...j.itens].sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
    const hora = new Date(j.atualizado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion' });
    return { atualizado: hora, linhas: itens.map(formatar) };
  } catch {
    return null;
  }
}

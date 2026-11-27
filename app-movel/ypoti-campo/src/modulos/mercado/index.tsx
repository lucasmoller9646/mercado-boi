import type { Modulo } from '../tipos';
import { EnMigracion } from '../en-migracion';

/**
 * Mercado do Boi dentro do Ypoti Campo. Abre o painel web tal como é hoje (versão de celular: abas embaixo,
 * deslizar troca de tela). Precisa estar publicado em ypoti.com/apps/mercado-boi/ (o app só abre por dentro
 * endereços de ypoti.com/apps/). A chave da ponte de dados se cola uma vez na engrenagem do próprio painel.
 */
export const mercado: Modulo = {
  id: 'mercado',
  nombre: 'Mercado do Boi',
  descripcion: 'Boi gordo, milho, reposição, lucratividade e câmbio',
  icono: 'chart-line',
  tono: 'gerencia',
  orden: 60,
  web: 'https://ypoti.com/apps/mercado-boi/',
  inicio: 'inicio',
  pantallas: {
    inicio: {
      titulo: 'Mercado do Boi',
      componente: () => (
        <EnMigracion
          nombre="Mercado do Boi"
          funciones={[
            'Boi gordo no Paraguai e no Brasil, basis e curva futura',
            'Reposição: indicador dos leilões, α, β e a curva de 2º grau',
            'Lucratividade da recria e do confinamento, mês a mês',
            'Câmbio do BCP com leitura técnica e notícias',
          ]}
        />
      ),
    },
  },
};

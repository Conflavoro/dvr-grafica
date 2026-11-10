import { ATTIVAZIONE_AZIENDA, ISPEZIONI_AZIENDA, SEZIONI_AZIENDA } from '@/lib/portale/sezioni';
import { PaginaPortale } from '@/components/portale/viste/PaginaPortale';

export function generateStaticParams() {
  return [...SEZIONI_AZIENDA.map((s) => ({ sezione: s.chiave })), { sezione: ISPEZIONI_AZIENDA.chiave }, { sezione: ATTIVAZIONE_AZIENDA.chiave }, { sezione: 'tutto' }, { sezione: 'account' }, { sezione: 'notifiche' }];
}

// Next 15: params arriva come Promise anche nell'export statico.
export default async function Pagina({ params }: { params: Promise<{ sezione: string }> }) {
  const { sezione } = await params;
  return <PaginaPortale app="azienda" sezione={sezione} />;
}

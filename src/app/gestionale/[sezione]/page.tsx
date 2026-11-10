import { SEZIONI_GESTIONALE } from '@/lib/portale/sezioni';
import { PaginaPortale } from '@/components/portale/viste/PaginaPortale';

export function generateStaticParams() {
  return [...SEZIONI_GESTIONALE.map((s) => ({ sezione: s.chiave })), { sezione: 'tutto' }, { sezione: 'account' }, { sezione: 'notifiche' }];
}

// Next 15: params arriva come Promise anche nell'export statico.
export default async function Pagina({ params }: { params: Promise<{ sezione: string }> }) {
  const { sezione } = await params;
  return <PaginaPortale app="gestionale" sezione={sezione} />;
}

'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function Indice() {
  const r = useRouter();
  useEffect(() => r.replace('/azienda/dashboard/'), [r]);
  return null;
}

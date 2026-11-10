import {
  buildPayload,
  initialValues,
  validateValues,
  type EntityFormField,
} from './entity-form';

interface Sample {
  company_id: number;
  nome: string;
  durata_ore: number;
  marcatura_ce: boolean;
  partecipanti: string[];
  data_prevista: string;
  note: string;
}

const fields: EntityFormField<Sample>[] = [
  { key: 'nome', label: 'Nome', type: 'text', required: true },
  { key: 'durata_ore', label: 'Ore', type: 'number', required: true, min: 0 },
  { key: 'marcatura_ce', label: 'CE', type: 'boolean' },
  { key: 'partecipanti', label: 'Partecipanti', type: 'csv' },
  { key: 'data_prevista', label: 'Data', type: 'date' },
  { key: 'note', label: 'Note', type: 'textarea' },
];

describe('entity-form buildPayload', () => {
  it('coerce number, boolean, csv array e omette opzionali vuoti', () => {
    const out = buildPayload(
      fields,
      {
        company_id: '7',
        nome: '  Mario  ',
        durata_ore: '4',
        marcatura_ce: true,
        partecipanti: 'Mario, Luigi ,  ',
        data_prevista: '2026-07-01',
        note: '',
      },
      { needsCompany: true }
    );
    expect(out).toEqual({
      company_id: 7,
      nome: 'Mario',
      durata_ore: 4,
      marcatura_ce: true,
      partecipanti: ['Mario', 'Luigi'],
      data_prevista: '2026-07-01',
    });
    expect('note' in out).toBe(false);
  });

  it('non include company_id quando needsCompany è false', () => {
    const out = buildPayload(fields, { company_id: '7', nome: 'X', durata_ore: '1', marcatura_ce: false }, {
      needsCompany: false,
    });
    expect('company_id' in out).toBe(false);
    expect(out.marcatura_ce).toBe(false);
  });

  it('omette numeri non validi', () => {
    const out = buildPayload(fields, { nome: 'X', durata_ore: 'abc', marcatura_ce: false }, {
      needsCompany: false,
    });
    expect('durata_ore' in out).toBe(false);
  });
});

describe('entity-form validateValues', () => {
  it('segnala required mancanti e azienda obbligatoria', () => {
    const errors = validateValues(
      fields,
      { company_id: '', nome: '', durata_ore: '', marcatura_ce: false },
      { needsCompany: true, companyRequired: true }
    );
    expect('company_id' in errors).toBe(true);
    expect('nome' in errors).toBe(true);
    expect('durata_ore' in errors).toBe(true);
  });

  it('valida i limiti numerici', () => {
    const errors = validateValues(
      fields,
      { nome: 'X', durata_ore: '-3', marcatura_ce: false },
      { needsCompany: false, companyRequired: false }
    );
    expect('durata_ore' in errors).toBe(true);
  });

  it('passa con dati validi', () => {
    const errors = validateValues(
      fields,
      { company_id: '1', nome: 'X', durata_ore: '2', marcatura_ce: false },
      { needsCompany: true, companyRequired: true }
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('entity-form initialValues', () => {
  it('serializza record esistente per gli input HTML', () => {
    const v = initialValues(fields, {
      durata_ore: 8,
      marcatura_ce: true,
      partecipanti: ['A', 'B'],
      nome: 'Anna',
    });
    expect(v.durata_ore).toBe('8');
    expect(v.marcatura_ce).toBe(true);
    expect(v.partecipanti).toBe('A, B');
    expect(v.nome).toBe('Anna');
  });

  it('valori vuoti su record assente', () => {
    const v = initialValues(fields, null);
    expect(v.nome).toBe('');
    expect(v.marcatura_ce).toBe(false);
    expect(v.partecipanti).toBe('');
  });
});

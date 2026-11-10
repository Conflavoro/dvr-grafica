import { controllaPassword, controllaRegistrazione, mappaEsito, mappaSedi, mappaSicurezza, mascheraNumero } from './accesso-api';

describe('accesso: controlli e mappatori', () => {
  it('controlli in ordine: prima l email, poi il cellulare', () => {
    expect(controllaRegistrazione('nome@azienda', '12')).toBe("Controlla l'email: sembra incompleta.");
    expect(controllaRegistrazione('nome@azienda.it', '0583 123456')).toBe('Controlla il cellulare: deve iniziare con 3 e avere 9 o 10 cifre.');
    expect(controllaRegistrazione('nome@azienda.it', '333 123 4567')).toBeNull();
    expect(mascheraNumero('333 123 4567')).toBe('+39 333 ••• ••67');
  });

  it('password: errori della specifica', () => {
    expect(controllaPassword('', 'corta', 'x', true)).toEqual({
      attuale: 'Scrivi la password che usi adesso.',
      nuova: 'La nuova password deve avere almeno 12 caratteri.',
      ripeti: 'Le due password non coincidono.',
    });
    expect(controllaPassword('UnaPasswordLunga', 'UnaPasswordLunga', 'UnaPasswordLunga', true)).toEqual({ nuova: 'La nuova password deve essere diversa da quella attuale.' });
    expect(controllaPassword('', 'NuovaPassword12', 'NuovaPassword12', false)).toEqual({});
  });

  it('mappatori tolleranti', () => {
    expect(mappaEsito({ secondo_passaggio: true, sfida: 'x', configura: true, otpauth: 'otpauth://totp/a' })).toMatchObject({ token: null, sfida: 'x', configura: true });
    expect(mappaSicurezza({ data: { email: 'a@b.it', due_passaggi: { attiva: true, numero_finale: '81' }, sessioni: [{ id: 2, dispositivo: 'Chrome su Mac', questo: true }] } }))
      .toMatchObject({ duePassaggi: { attiva: true, numeroFinale: '81' }, dispositivi: [{ id: 2, questo: true, tipo: 'monitor' }] });
    expect(mappaSedi({ data: { sedi: [{ id: 3, nome: 'Viareggio', medico: { nome: 'Dott.ssa P', coordinatore: true } }], limitata: true, testo_limite: 'Il tuo accesso è limitato a questa sede' } }))
      .toMatchObject({ limitata: true, sedi: [{ id: 3, medico: { coordinatore: true } }] });
    expect(mappaSicurezza(null).dispositivi).toEqual([]);
  });
});

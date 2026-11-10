import { nomeDaApple } from './AppleLoginButton';
import { messaggioErrore, PAROLA_CONFERMA } from '@/components/portale/viste/condivisi/Account';
import { ApiError } from '@/lib/api';

describe('accesso con Apple e cancellazione account', () => {
  test('nome completo solo se Apple lo manda', () => {
    expect(nomeDaApple('Giulia', 'Verdi')).toBe('Giulia Verdi');
    expect(nomeDaApple(' Giulia ', null)).toBe('Giulia');
    expect(nomeDaApple(null, null)).toBeNull();
  });

  test('la conferma e la parola ELIMINA', () => {
    expect(PAROLA_CONFERMA).toBe('ELIMINA');
  });

  test('il messaggio del server arriva intero (titolare unico)', () => {
    const e = new ApiError(409, { message: 'Sei l\'unico titolare dello studio.' }, 'x');
    expect(messaggioErrore(e)).toBe('Sei l\'unico titolare dello studio.');
    expect(messaggioErrore(new Error('rete'))).toMatch(/Riprova/);
  });
});

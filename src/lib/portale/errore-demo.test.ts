import { ApiError } from '@/lib/api';
import { erroreLeggibile } from './api';

describe('tetti della demo dal vivo', () => {
  it('mostra il messaggio del backend quando il tetto del giorno è raggiunto', () => {
    const e = new ApiError(429, { message: 'Nella demo sono previsti al massimo 3 DVR al giorno: riprova domani.', codice: 'tetto_demo' }, 'x');
    expect(erroreLeggibile(e).message).toBe('Nella demo sono previsti al massimo 3 DVR al giorno: riprova domani.');
  });

  it('un 429 normale resta il limite al minuto', () => {
    expect(erroreLeggibile(new ApiError(429, { message: 'Too Many Attempts.' }, 'x')).message).toBe('Troppe richieste in poco tempo. Riprova tra un minuto.');
  });
});

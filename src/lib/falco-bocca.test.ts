import { ascoltaBocca, boccaSuTesto, chiudiBocca, livelloDaAmpiezza, sequenzaSillabe, stimaDurata } from './falco-bocca';

describe('bocca del falco', () => {
  it('apre sulle vocali e chiude sulla punteggiatura', () => {
    expect(sequenzaSillabe('Ciao.')).toEqual([1, 2, 2, 0, 0]);
    expect(sequenzaSillabe('')).toEqual([1, 2, 1, 0]);
  });

  it('livello dall ampiezza della voce', () => {
    expect(livelloDaAmpiezza(0.01)).toBe(0);
    expect(livelloDaAmpiezza(0.06)).toBe(1);
    expect(livelloDaAmpiezza(0.3)).toBe(2);
  });

  it('recita il testo e alla fine chiude la bocca e avvisa', () => {
    jest.useFakeTimers();
    const livelli: number[] = [];
    const via = ascoltaBocca((a) => livelli.push(a));
    const fine = jest.fn();
    boccaSuTesto('Buongiorno a tutti', 1000, fine);
    jest.advanceTimersByTime(5000);
    expect(livelli).toContain(2);
    expect(livelli[livelli.length - 1]).toBe(0);
    expect(fine).toHaveBeenCalledTimes(1);
    via();
    jest.useRealTimers();
  });

  it('interrompere chiude e avvisa una sola volta', () => {
    jest.useFakeTimers();
    const fine = jest.fn();
    boccaSuTesto('Una risposta lunga da leggere', 3000, fine);
    chiudiBocca();
    chiudiBocca();
    expect(fine).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('durata stimata con limiti', () => {
    expect(stimaDurata('ok')).toBe(900);
    expect(stimaDurata('x'.repeat(5000))).toBe(60000);
  });
});

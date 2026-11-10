// Dichiarazioni ambient minime per i global di Jest usati nei test del DataSource.
// Evita la dipendenza @types/jest (non disponibile offline) mantenendo la
// type-safety di base in tsc. NON e' un sostituto completo di @types/jest:
// copre solo le API effettivamente usate nei nostri test.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare namespace jest {
  interface Mock<T = any, Y extends any[] = any[]> {
    (...args: Y): T;
    mockImplementationOnce(fn: (...args: Y) => T): this;
    mockImplementation(fn: (...args: Y) => T): this;
    mockReturnValue(v: T): this;
    mockResolvedValue(v: any): this;
    mockReset(): void;
    mockClear(): void;
  }
}

declare const jest: {
  fn<T = any>(impl?: (...args: any[]) => T): jest.Mock<T>;
  clearAllMocks(): void;
  resetAllMocks(): void;
  useFakeTimers(): void;
  useRealTimers(): void;
  advanceTimersByTime(ms: number): void;
};

declare function describe(name: string, fn: () => void): void;
declare namespace describe {
  function each(cases: any[][]): (name: string, fn: (...args: any[]) => void) => void;
}
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;

interface JestMatchers<R> {
  toBe(expected: unknown): R;
  toEqual(expected: unknown): R;
  toMatchObject(expected: object): R;
  toHaveLength(n: number): R;
  toContain(s: unknown): R;
  toMatch(re: RegExp | string): R;
  toBeLessThan(n: number): R;
  toBeGreaterThan(n: number): R;
  toBeGreaterThanOrEqual(n: number): R;
  toBeNull(): R;
  toThrow(msg?: string | RegExp): R;
  toHaveBeenCalled(): R;
  toHaveBeenCalledTimes(n: number): R;
  toHaveBeenCalledWith(...args: unknown[]): R;
  rejects: JestMatchers<Promise<R>>;
  resolves: JestMatchers<Promise<R>>;
  not: JestMatchers<R>;
}

declare function expect<T = unknown>(actual: T): JestMatchers<void>;

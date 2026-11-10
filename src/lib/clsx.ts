// Tiny clsx utility (subset di github.com/lukeed/clsx) — evita dep esterna.

type Val = string | number | boolean | null | undefined | Record<string, unknown> | Val[];

export function clsx(...args: Val[]): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === 'string' || typeof a === 'number') {
      out.push(String(a));
    } else if (Array.isArray(a)) {
      const inner = clsx(...a);
      if (inner) out.push(inner);
    } else if (typeof a === 'object') {
      for (const [k, v] of Object.entries(a)) {
        if (v) out.push(k);
      }
    }
  }
  return out.join(' ');
}

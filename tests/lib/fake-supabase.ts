/**
 * Supabase finto per i test: ogni query concatenata (from().select().eq()…)
 * registra le operazioni e, quando viene attesa, risolve con la prossima
 * risposta della coda.
 */
export interface FakeQuery {
  table: string;
  ops: [string, unknown[]][];
}

export function fakeSupabase(responses: unknown[]) {
  const queries: FakeQuery[] = [];
  const db = {
    from(table: string) {
      const q: FakeQuery = { table, ops: [] };
      queries.push(q);
      const builder: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              const next = responses.length ? responses.shift() : { data: null, error: { message: "nessuna risposta in coda" } };
              return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
                Promise.resolve(next).then(resolve, reject);
            }
            return (...args: unknown[]) => {
              q.ops.push([String(prop), args]);
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
  return { db, queries };
}

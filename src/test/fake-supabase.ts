import type { SupabaseClient } from "@supabase/supabase-js";

export interface Query {
  table: string;
  op: "select" | "insert" | "delete";
  values?: Record<string, unknown>;
  filters: Record<string, unknown>;
}

export type Result = { data?: unknown; error?: { message: string } | null };

type ChangeHandler = (payload: { new: unknown; old: unknown }) => void;

/** Just enough of the Supabase client for useLiveCommunity, plus a Realtime trigger. */
export function fakeSupabase(respond: (query: Query) => Result) {
  const queries: Query[] = [];
  const handlers: { event: string; table: string; handler: ChangeHandler }[] = [];
  const from = (table: string) => {
    const query: Query = { table, op: "select", filters: {} };
    const builder: Record<string, unknown> = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            queries.push(query);
            const result = respond(query);
            return (resolve: (value: Result) => void) =>
              resolve({ data: result.data ?? null, error: result.error ?? null });
          }
          if (prop === "insert") {
            return (values: Record<string, unknown>) => {
              query.op = "insert";
              query.values = values;
              return builder;
            };
          }
          if (prop === "delete") {
            return () => {
              query.op = "delete";
              return builder;
            };
          }
          if (prop === "eq") {
            return (column: string, value: unknown) => {
              query.filters[column] = value;
              return builder;
            };
          }
          return () => builder;
        },
      },
    );
    return builder;
  };
  const channel = {
    on: (_type: string, filter: { event: string; table: string }, handler: ChangeHandler) => {
      handlers.push({ event: filter.event, table: filter.table, handler });
      return channel;
    },
    subscribe: (callback?: (status: string) => void) => {
      callback?.("SUBSCRIBED");
      return channel;
    },
  };
  const client = {
    from,
    rpc: (fn: string) => from(fn),
    channel: () => channel,
    removeChannel: async () => "ok",
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInAnonymously: async () => ({ data: { user: { id: "me" } }, error: null }),
      signOut: async () => ({ error: null }),
    },
  };

  /** Deliver a Realtime INSERT, as if another device had just reported. */
  const emitInsert = (table: string, row: Record<string, unknown>) => {
    for (const h of handlers) {
      if (h.event === "INSERT" && h.table === table) h.handler({ new: row, old: {} });
    }
  };

  return { client: client as unknown as SupabaseClient, queries, emitInsert };
}

export const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

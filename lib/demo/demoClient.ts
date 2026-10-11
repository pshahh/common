// Demo mode for App Store screenshots: an in-memory stand-in for the Supabase
// client that answers from lib/demo/fixtures.ts. It makes no network requests,
// so it can never read from or write to a real project.
//
// Only reachable from lib/supabase.ts behind process.env.NODE_ENV ===
// 'development', so production builds don't include it. Turn it on by opening
// the dev server with ?demo=1.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDemoTables, demoUser, DEMO_GROUP_THREAD_ID } from './fixtures';
import { PUSH_SUBSCRIBED_KEY } from '../nativePush';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: null; count: number | null };

export function isDemoMode(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
}

let idCounter = 0;
const newId = (table: string) => `demo-${table}-${++idCounter}`;

class DemoQuery implements PromiseLike<Result> {
  private filters: ((row: Row) => boolean)[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitTo: number | null = null;
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: Row[] = [];
  private returnSingle: 'single' | 'maybeSingle' | null = null;
  private headOnly = false;

  constructor(private tables: Record<string, Row[]>, private table: string) {}

  private get rows(): Row[] {
    return (this.tables[this.table] ??= []);
  }

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(values: Row | Row[]) {
    this.mode = 'insert';
    this.payload = (Array.isArray(values) ? values : [values]).map((v) => ({
      id: newId(this.table),
      created_at: new Date().toISOString(),
      ...v,
    }));
    return this;
  }

  upsert(values: Row | Row[]) {
    this.insert(values);
    this.mode = 'upsert';
    return this;
  }

  update(values: Row) {
    this.mode = 'update';
    this.payload = [values];
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  contains(column: string, values: unknown[]) {
    this.filters.push((row) => {
      const cell = row[column];
      return Array.isArray(cell) && values.every((v) => cell.includes(v));
    });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  // Filters the demo doesn't need to evaluate: the fixtures are already the
  // rows these would select (e.g. posts that haven't expired).
  or() { return this; }
  not() { return this; }
  gt() { return this; }
  gte() { return this; }
  lt() { return this; }
  lte() { return this; }
  ilike() { return this; }
  like() { return this; }
  filter() { return this; }
  match() { return this; }
  range() { return this; }
  returns() { return this; }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitTo = count;
    return this;
  }

  single() {
    this.returnSingle = 'single';
    return this;
  }

  maybeSingle() {
    this.returnSingle = 'maybeSingle';
    return this;
  }

  private run(): Result {
    if (this.mode === 'insert' || this.mode === 'upsert') {
      this.rows.push(...this.payload);
      return this.shape(this.payload);
    }

    let matched = this.rows.filter((row) => this.filters.every((f) => f(row)));

    if (this.mode === 'update') {
      matched.forEach((row) => Object.assign(row, this.payload[0]));
      return this.shape(matched);
    }
    if (this.mode === 'delete') {
      this.tables[this.table] = this.rows.filter((row) => !matched.includes(row));
      return this.shape(matched);
    }

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      matched = [...matched].sort((a, b) => {
        const av = String(a[column] ?? '');
        const bv = String(b[column] ?? '');
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (this.limitTo !== null) matched = matched.slice(0, this.limitTo);
    return this.shape(matched);
  }

  private shape(rows: Row[]): Result {
    if (this.headOnly) return { data: null, error: null, count: rows.length };
    if (this.returnSingle) return { data: rows[0] ?? null, error: null, count: null };
    return { data: rows, error: null, count: rows.length };
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function createDemoClient(): SupabaseClient {
  const tables = buildDemoTables();
  const session = { user: demoUser, access_token: 'demo', refresh_token: 'demo', expires_in: 3600, token_type: 'bearer' };

  // Skip push registration: it would show the system permission prompt and
  // store a device token.
  try {
    sessionStorage.setItem(PUSH_SUBSCRIBED_KEY, 'true');
  } catch {
    // Storage unavailable; registration will just fail quietly instead
  }

  // Hide the Next.js dev indicator so it doesn't appear in screenshots
  const style = document.createElement('style');
  style.textContent = 'nextjs-portal { display: none !important; }';
  document.head.appendChild(style);

  const channel = {
    on() { return channel; },
    subscribe() { return channel; },
    unsubscribe() { return Promise.resolve('ok'); },
  };

  const ok = <T>(data: T) => Promise.resolve({ data, error: null });

  const client = {
    from: (table: string) => new DemoQuery(tables, table),
    rpc: (name: string) => {
      if (name === 'join_group_thread') return ok({ thread_id: DEMO_GROUP_THREAD_ID });
      return ok(null);
    },
    channel: () => channel,
    removeChannel: () => Promise.resolve('ok'),
    auth: {
      getSession: () => ok({ session }),
      getUser: () => ok({ user: demoUser }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithPassword: () => ok({ user: demoUser, session }),
      signUp: () => ok({ user: demoUser, session }),
    },
    storage: {
      from: () => ({
        upload: () => ok({ path: 'demo' }),
        remove: () => ok([]),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
    functions: {
      invoke: () => ok(null),
    },
  };

  return client as unknown as SupabaseClient;
}

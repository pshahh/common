import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Demo mode (App Store screenshots) swaps in a local fake client, so the real
// project is never touched. process.env.NODE_ENV is inlined at build time, so
// production builds drop this branch and the demo fixtures with it.
let demoClient: SupabaseClient | null = null;
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const demo = require('./demo/demoClient');
  if (demo.isDemoMode()) demoClient = demo.createDemoClient();
}

export const isDemo = demoClient !== null;

export const supabase = demoClient ?? createClient(supabaseUrl, supabaseAnonKey);

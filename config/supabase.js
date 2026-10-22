import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';
import { timedSupabaseFetch } from '../utils/request-timing.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Please define SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: timedSupabaseFetch },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const createAuthenticatedSupabaseClient = (accessToken) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: timedSupabaseFetch,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

export default supabase;

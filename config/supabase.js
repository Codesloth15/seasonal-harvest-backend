import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Please define SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;

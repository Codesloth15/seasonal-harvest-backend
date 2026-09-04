import {config} from 'dotenv';

config({path: `.env.${process.env.NODE_ENV || 'development'}.local`});

export const {
  PORT,
  ARCJET_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  FRONTEND_URL,
  CORS_ORIGINS,
  ANTHROPIC_MODEL,
  AI_RATE_LIMIT_MAX,
  AI_RATE_LIMIT_WINDOW_MS,
} = process.env;

// Temporary fallback lets existing local environments migrate without exposing
// or copying their secret. Rename GEMINI_API_KEY to ANTHROPIC_API_KEY when able.
export const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;

import {config} from 'dotenv';

config({path: `.env.${process.env.NODE_ENV || 'development'}.local`});

export const {
  PORT,
  ARCJET_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  FRONTEND_URL,
  CORS_ORIGINS,
  OPENAI_API_KEY,
  OPENAI_MODEL,
} = process.env;

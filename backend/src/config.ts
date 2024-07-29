import 'dotenv/config';

export const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN_DEV || '';
if (!TELEGRAM_TOKEN) {
  throw new Error('TELEGRAM_TOKEN is not set');
}

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
export const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
export const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME!;
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
export const TG_URL = process.env.TG_URL!;

import TelegramBot from 'node-telegram-bot-api';
import { initHandlers } from './handlers';
import { TELEGRAM_TOKEN } from './config';
import 'dotenv/config';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
console.log('Telegram bot started');

initHandlers(bot);

export default bot;

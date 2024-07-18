import TelegramBot from 'node-telegram-bot-api';
import { getEventChunks, getRecommendations } from './recomendation';
import User from './user/models/User';
import 'dotenv/config';
import buyTickets from './buyTickets';
import EventModel from './event/models/Event';
import cron from 'node-cron';

// CHANGE TOKEN IF YOU DEPLOY
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN_DEV || '';
if (!TELEGRAM_TOKEN) {
  throw new Error('TELEGRAM_TOKEN is not set');
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log('Telegram bot started');

interface UserPreferences {
  spendingLimit?: number;
  hobbies?: string[];
  userName?: string;
  recommendations?: string[];
  lastRecommendationIndex?: number;
  pendingTicketPurchase?: {
    url: string;
    chatId: string;
  };
}

const userSetupStages: { [chatId: string]: { stage: number, field?: string } } = {};

const commandMenu = [
  [{ text: 'Изменить бюджет', callback_data: '/change_spendingLimit' }],
  [{ text: 'Изменить увлечения', callback_data: '/change_hobbies' }],
  [{ text: 'Остановить сеанс', callback_data: '/stop_session' }],
];

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.username || '';
  console.log('username', userName);

  if (userName) {
    let user = await User.findOne({ userName });
    if (!user) {
      user = new User({
        userName,
        chatId,
        recommendations: [],
        lastRecommendationIndex: 0,
        stopSession: false
      });
      await user.save();
      userSetupStages[chatId] = { stage: 0 };

      await bot.sendMessage(chatId, `👋 Добро пожаловать, *${userName}*, в Seruen! Мы очень рады, что вы присоединились к нам. Давайте немного познакомимся, и мы будем присылать вам персонализированные рекомендации по мероприятиям в вашем городе! Для начала введите свой email:`, { parse_mode: 'Markdown' });
    } else {
      user.chatId = chatId.toString();
      user.stopSession = false;
      await user.save();

      const welcomeMessage = `👋 Добро пожаловать, *${userName}*, в Seruen! Мы очень рады, что вы присоединились к нам. Теперь мы будем присылать вам персонализированные рекомендации по мероприятиям в вашем городе!`;

      await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
      await bot.sendMessage(chatId, 'Мы готовим для вас рекомендации. Они начнут приходить очень скоро!', { parse_mode: 'Markdown' });

      try {
        const events = await EventModel.find();
        const CHUNK_SIZE = 10;
        const eventChunks = getEventChunks(events, CHUNK_SIZE);
        const userRecomendation: { venue: string; ticketLink: string; message: string; score: number }[] = [];

        user.lastRecommendationIndex = 0;

        for (let i = 0; i < eventChunks.length; i++) {
          const chunk = eventChunks[i];
          const userSession = await User.findOne({ chatId });
          if (userSession?.stopSession) {
            return;
          }

          const recommendations = await getRecommendations(chunk, user);
          userRecomendation.push(...recommendations);

          console.log("USERRECOMMENDATIONS", userRecomendation);
        }

        user.recommendations = userRecomendation.sort((a, b) => b.score - a.score);
        console.log('DB RECOMMENDATIONS', user.recommendations);
        await user.save();

        await bot.sendMessage(chatId, '✨ Мы завершили подготовку ваших рекомендаций. Наслаждайтесь мероприятиями!', { parse_mode: 'Markdown' });

        await sendNextEvent(chatId);

      } catch (error) {
        console.error(`Ошибка при получении рекомендаций для chatId ${chatId}:`, error);
        await bot.sendMessage(chatId, '❌ Извините, произошла ошибка при получении рекомендаций.', { parse_mode: 'Markdown' });
      }
    }
  }
});

bot.onText(/\/change_budget/, async (msg) => {
  const chatId = msg.chat.id;
  userSetupStages[chatId] = { stage: 0, field: 'budget' };
  await bot.sendMessage(chatId, 'Пожалуйста, введите ваш новый бюджет (в тенге):', { parse_mode: 'Markdown' });
});

bot.onText(/\/change_hobbies/, async (msg) => {
  const chatId = msg.chat.id;
  userSetupStages[chatId] = { stage: 0, field: 'hobbies' };
  await bot.sendMessage(chatId, 'Пожалуйста, введите ваши новые увлечения (через запятую):', { parse_mode: 'Markdown' });
});

bot.onText(/\/stop_session/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });
  if (user) {
    user.stopSession = true;
    await user.save();
  }
  delete userSetupStages[chatId];
  await bot.sendMessage(chatId, '🛑 Сеанс завершен. Если захотите начать снова, используйте команду /start.', { parse_mode: 'Markdown' });
});


bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (!(chatId in userSetupStages)) return;

  const user = await User.findOne({ chatId });

  if (!user) {
    await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, начните заново, используя команду /start.', { parse_mode: 'Markdown' });
    return;
  }

  const { stage, field } = userSetupStages[chatId];

  switch (field) {
    case 'email':
      user.email = msg.text;
      break;
    case 'phone':
      user.phone = msg.text;
      break;
    case 'budget':
      user.spendingLimit = parseInt(msg.text);
      break;
    case 'hobbies':
      user.hobbies = msg.text.split(',').map(item => item.trim());
      break;
    default:
      switch (stage) {
        case 0:
          user.email = msg.text;
          userSetupStages[chatId] = { stage: 1 };
          await bot.sendMessage(chatId, 'Пожалуйста, введите ваш номер телефона:', { parse_mode: 'Markdown' });
          return;
        case 1:
          user.phone = msg.text;
          userSetupStages[chatId] = { stage: 2 };
          await bot.sendMessage(chatId, 'Пожалуйста, введите ваш бюджет (в тенге):', { parse_mode: 'Markdown' });
          return;
        case 2:
          user.spendingLimit = parseInt(msg.text);
          userSetupStages[chatId] = { stage: 3 };
          await bot.sendMessage(chatId, 'Пожалуйста, введите ваши увлечения (через запятую):', { parse_mode: 'Markdown' });
          return;
        case 3:
          user.hobbies = msg.text.split(',').map(item => item.trim());
          await user.save();
          delete userSetupStages[chatId];
          await bot.sendMessage(chatId, 'Спасибо! Ваши данные сохранены. Получаем ваши персонализированные рекомендации...', { parse_mode: 'Markdown' });
          break;
      }
  }

  await user.save();
  delete userSetupStages[chatId];
  await bot.sendMessage(chatId, 'Ваши данные обновлены. Получаем ваши персонализированные рекомендации...', { parse_mode: 'Markdown' });

  try {
    bot.sendMessage(chatId, 'Готовим для Вас рекомендации...', { parse_mode: 'Markdown' });
    const events = await EventModel.find();
    const CHUNK_SIZE = 10;
    const eventChunks = getEventChunks(events, CHUNK_SIZE);
    const userRecomendation: { venue: string; ticketLink: string; message: string; score: number }[] = [];

    user.lastRecommendationIndex = 0;

    for (let i = 0; i < eventChunks.length; i++) {
      const chunk = eventChunks[i];
      const userSession = await User.findOne({ chatId });
      if (userSession?.stopSession) {
        return;
      }

      const recommendations = await getRecommendations(chunk, user);
      userRecomendation.push(...recommendations);

      console.log("USERRECOMMENDATIONS", userRecomendation);
    }

    user.recommendations = userRecomendation.sort((a, b) => b.score - a.score);
    console.log('DB RECOMMENDATIONS', user.recommendations);
    await user.save();

    await bot.sendMessage(chatId, '✨ Мы завершили подготовку ваших рекомендаций. Наслаждайтесь мероприятиями!', { parse_mode: 'Markdown' });

    await sendNextEvent(chatId);

  } catch (error) {
    console.error(`Ошибка при получении рекомендаций для chatId ${chatId}:`, error);
    await bot.sendMessage(chatId, '❌ Извините, произошла ошибка при получении рекомендаций.', { parse_mode: 'Markdown' });
  }
});


const sendNextEvent = async (chatId: number) => {
  const user = await User.findOne({ chatId });

  if (!user || !user.recommendations || user.recommendations.length === 0) {
    await bot.sendMessage(chatId, 'У вас нет рекомендаций. Пожалуйста, сначала получите рекомендации.', { parse_mode: 'Markdown' });
    return;
  }

  if (user.stopSession) {
    return;
  }

  const nextEvent = user.recommendations[user.lastRecommendationIndex || 0];

  if (!nextEvent) {
    await bot.sendMessage(chatId, 'No more events to show.', { parse_mode: 'Markdown' });
    return;
  }

  await bot.sendMessage(chatId, nextEvent.message.replace(/\\n/g, '\n'), {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: "Купить билеты", callback_data: `buy_ticket_${user.lastRecommendationIndex}` }],
        [{ text: "Следующий ивент", callback_data: 'next_event' }]
      ]
    }
  });
  user.lastRecommendationIndex = (user.lastRecommendationIndex ?? 0) + 1;
  await user.save();
};

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg?.chat.id;

  if (!chatId) return;

  const action = callbackQuery.data;

  if (action === 'next_event') {
    sendNextEvent(chatId);
  } else if (action.startsWith('buy_ticket_')) {
    const index = parseInt(action.split('_')[2], 10);
    const user = await User.findOne({ chatId });
    const event = user?.recommendations?.[index];
    if (event) {
      await bot.sendMessage(chatId, `Покупка билета для мероприятия: ${event.venue}`, { parse_mode: 'Markdown' });
      if (event.ticketLink) {
        await bot.sendMessage(chatId, 'Покупаем билет, пожалуйста подождите...', { parse_mode: 'Markdown' });
        try {
          await buyTickets(event.ticketLink, chatId, bot);
          await bot.sendMessage(chatId, '🎫 Билеты успешно куплены!', { parse_mode: 'Markdown' });
        } catch (error) {
          console.error(`Ошибка при покупке билетов для chatId ${chatId}:`, error);
          await bot.sendMessage(chatId, '❌ Извините, произошла ошибка при покупке билетов.', { parse_mode: 'Markdown' });
        }
      } else {
        await bot.sendMessage(chatId, 'Извините, ссылка на билет недоступна.', { parse_mode: 'Markdown' });
      }
    }
  }

  bot.answerCallbackQuery(callbackQuery.id);
});


cron.schedule('0 */6 * * *', async () => {
  console.log('Запуск планировщика для отправки рекомендаций пользователям');
  try {
    const users = await User.find();
    for (const user of users) {
      if (!user.stopSession) {
        await sendNextEvent(Number(user.chatId));
      }
    }
  } catch (error) {
    console.error('Ошибка при отправке плановых рекомендаций:', error);
  }
});

export default bot;

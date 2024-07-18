import TelegramBot from 'node-telegram-bot-api';
import { getEventChunks, getRecommendations } from './recomendation';
import User from './user/models/User';
import 'dotenv/config';
import buyTickets from './buyTickets';
import EventModel from './event/models/Event';

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

      await bot.sendMessage(chatId, `Добро пожаловать, ${userName} в Seruen! Мы очень рады, что вы присоединились к нам. Давайте немного познакомимся, и мы будем присылать вам персонализированные рекомендации по мероприятиям в вашем городе! Для начала введите свой email:`);
    } else {
      user.chatId = chatId.toString();
      user.stopSession = false;
      await user.save();

      const welcomeMessage = `Добро пожаловать, ${userName} в Seruen! Мы очень рады, что вы присоединились к нам. Теперь мы будем присылать вам персонализированные рекомендации по мероприятиям в вашем городе!`;

      await bot.sendMessage(chatId, welcomeMessage);

      try {
        bot.sendMessage(chatId, 'Готовим для Вас рекомендации...');
        const CHUNK_SIZE = 10;
        const events = await EventModel.find();
        const eventChunks = getEventChunks(events, CHUNK_SIZE);
        const userRecomendation: { venue: string; ticketLink: string; message: string; }[] = [];
    
        user.lastRecommendationIndex = 0;
      
        for (const chunk of eventChunks) {
          const userSession = await User.findOne({ chatId });
          if (userSession?.stopSession) {
            return;
          }
          const recommendations = await getRecommendations(chunk, user);
          userRecomendation.push(...recommendations);
          console.log("USERRECOMMENDATIONS",userRecomendation);
          
          user.recommendations = userRecomendation;
          console.log('DB RECOMEN', user.recommendations);
          await user.save();
          await sendNextEvent(chatId); 
        }
        
      } catch (error) {
        console.error(`Ошибка при получении рекомендаций для chatId ${chatId}:`, error);
        await bot.sendMessage(chatId, 'Извините, произошла ошибка при получении рекомендаций.');
      }
    }
  }
});

bot.onText(/\/change_spendingLimit/, async (msg) => {
  const chatId = msg.chat.id;
  userSetupStages[chatId] = { stage: 0, field: 'spendingLimit' };
  await bot.sendMessage(chatId, 'Пожалуйста, введите ваш новый бюджет (в тенге):');
});

bot.onText(/\/change_hobbies/, async (msg) => {
  const chatId = msg.chat.id;
  userSetupStages[chatId] = { stage: 0, field: 'hobbies' };
  await bot.sendMessage(chatId, 'Пожалуйста, введите ваши новые увлечения (через запятую):');
});

bot.onText(/\/stop_session/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });
  if (user) {
    user.stopSession = true;
    await user.save();
  }
  delete userSetupStages[chatId];
  await bot.sendMessage(chatId, 'Сеанс завершен. Если захотите начать снова, используйте команду /start.');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (!(chatId in userSetupStages)) return;

  const user = await User.findOne({ chatId });

  if (!user) {
    await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, начните заново, используя команду /start.');
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
    case 'spendingLimit':
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
          await bot.sendMessage(chatId, 'Пожалуйста, введите ваш номер телефона:');
          return;
        case 1:
          user.phone = msg.text;
          userSetupStages[chatId] = { stage: 2 };
          await bot.sendMessage(chatId, 'Пожалуйста, введите ваш бюджет (в тенге):');
          return;
        case 2:
          user.spendingLimit = parseInt(msg.text);
          userSetupStages[chatId] = { stage: 3 };
          await bot.sendMessage(chatId, 'Пожалуйста, введите ваши увлечения (через запятую):');
          return;
        case 3:
          user.hobbies = msg.text.split(',').map(item => item.trim());
          await user.save();
          delete userSetupStages[chatId];
          await bot.sendMessage(chatId, 'Спасибо! Ваши данные сохранены. Получаем ваши персонализированные рекомендации...');
          break;
      }
  }

  await user.save();
  delete userSetupStages[chatId];
  await bot.sendMessage(chatId, 'Ваши данные обновлены. Получаем ваши персонализированные рекомендации...');

  try {
    bot.sendMessage(chatId, 'Готовим для Вас рекомендации...');
    const CHUNK_SIZE = 10;
    const events = await EventModel.find();
    const eventChunks = getEventChunks(events, CHUNK_SIZE);
    const userRecomendation: { venue: string; ticketLink: string; message: string; }[] = [];

    user.lastRecommendationIndex = 0;
  
    for (const chunk of eventChunks) {
      const userSession = await User.findOne({ chatId });
      if (userSession?.stopSession) {
        return;
      }
      const recommendations = await getRecommendations(chunk, user);
      userRecomendation.push(...recommendations);
      console.log("USERRECOMMENDATIONS",userRecomendation);
      
      user.recommendations = userRecomendation;
      await sendNextEvent(chatId); 
    }

    
    await user.save();
  } catch (error) {
    console.error(`Ошибка при получении рекомендаций для chatId ${chatId}:`, error);
    await bot.sendMessage(chatId, 'Извините, произошла ошибка при получении рекомендаций.');
  }
});

const sendNextEvent = async (chatId) => {
  const user = await User.findOne({ chatId });

  if (!user || !user.recommendations || user.recommendations.length === 0) {
    await bot.sendMessage(chatId, 'У вас нет рекомендаций. Пожалуйста, сначала получите рекомендации.');
    return;
  }

  if (user.stopSession) {
    return;
  }

  const nextEvent = user.recommendations[user.lastRecommendationIndex || 0];

  if (!nextEvent) {
    await bot.sendMessage(chatId, 'No more events to show.');
    return;
  }

  await bot.sendMessage(chatId, nextEvent.message.replace(/\\n/g, '\n'), {
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
      await bot.sendMessage(chatId, `Покупка билета для мероприятия: ${event.venue}`);
      if (event.ticketLink) {
        await bot.sendMessage(chatId, 'Покупаем билет, пожалуйста подождите...');
        try {
          await buyTickets(event.ticketLink, chatId, bot);
          await bot.sendMessage(chatId, 'Билеты успешно куплены!');
        } catch (error) {
          console.error(`Ошибка при покупке билетов для chatId ${chatId}:`, error);
          await bot.sendMessage(chatId, 'Извините, произошла ошибка при покупке билетов.');
        }
      } else {
        await bot.sendMessage(chatId, 'Извините, ссылка на билет недоступна.');
      }
    }
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

export default bot;
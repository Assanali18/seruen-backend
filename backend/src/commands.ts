import TelegramBot from 'node-telegram-bot-api';
import User from './user/models/User';
import EventModel from './event/models/Event';
import { createHobbiesKeyboard, createPreferencesMenu } from './keyboard';
import { getEventChunks, sendNextEvent, sendNextGeneratedEvent, userSetupStages } from './util';
import { getRecommendations } from './recomendation';
import path from 'path';
import { TG_URL } from './config';

const MAX_CALLBACK_DATA_LENGTH = 64;

function createCallbackData(prefix: string, data: string): string {
  let encodedData = encodeURIComponent(data);
  if (encodedData.length > MAX_CALLBACK_DATA_LENGTH - prefix.length) {
    encodedData = encodedData.substring(0, MAX_CALLBACK_DATA_LENGTH - prefix.length - 3) + '...';
  }
  return `${prefix}_${encodedData}`;
}

export const handleStart = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  console.log('Received /start in chatId:', chatId);

  const userName = msg.from?.username || '';
  const firstName = msg.from?.first_name || '';

  const uniqueUserId = userName || firstName || `user_${chatId}`;

  if (uniqueUserId) {
    let user = await User.findOne({ userName: uniqueUserId });
    if (!user) {
      user = new User({
        userName: uniqueUserId,
        chatId,
        recommendations: [],
        lastRecommendationIndex: 0,
        generatedPosts: [],
        lastGeneratedPostIndex: 0,
        stopSession: false,
        points: 0 
      });

      if (msg.text.length > 6) {
        const refID = msg.text.slice(7);
        const referrer = await User.findOne({ chatId: refID });
        if (referrer) {
          if (referrer.points !== undefined) {
            referrer.points += 1;
            await referrer.save();
            await bot.sendMessage(referrer.chatId, `🎉 Вы пригласили нового пользователя и у вас уже ${referrer.points}. Если у вас 10 то напишите @us_sun!`);
          }
        }
        await bot.sendMessage(msg.chat.id, `Вы зашли по ссылке пользователя с ID ${refID}`);
      }

      userSetupStages[chatId] = { stage: 0, field: 'budget' };
      await user.save();

      const welcomeMessage = `👋 Добро пожаловать, ${firstName}, в Seruen!
      
Мы очень рады, что вы присоединились к нам. Давайте немного познакомимся, и мы будем присылать вам персонализированные рекомендации по мероприятиям в вашем городе!`;

      await bot.sendMessage(chatId, welcomeMessage);

      const budgetMessage = 'Для начала выберите ваш бюджет:';

      await bot.sendMessage(chatId, budgetMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '0 - 5000 тенге', callback_data: 'budget_5000' }, { text: '5000 - 10000 тенге', callback_data: 'budget_10000' }],
            [{ text: '10000 - 20000 тенге', callback_data: 'budget_20000' }, { text: '20000 - 30000 тенге', callback_data: 'budget_30000' }],
            [{ text: '30000 - 40000 тенге', callback_data: 'budget_40000' }, { text: '40000 - 50000 тенге', callback_data: 'budget_50000' }],
            [{ text: '50000+ тенге', callback_data: 'budget_100000' }]
          ]
        }
      });

    } else {
      user.chatId = chatId.toString();
      user.stopSession = false;
      await user.save();

      const welcomeMessage = `👋 Добро пожаловать, ${firstName}, в Seruen!
      
Мы очень рады, что вы снова с нами. Теперь мы будем присылать вам персонализированные рекомендации по мероприятиям в вашем городе!
Если сообщение не придет в течение 7 минут, нажмите /start заново или напишите мне @us_sun.`;

      const imagePath = path.join(__dirname, 'assets', 'almaty.png');

      await bot.sendPhoto(chatId, imagePath, { caption: welcomeMessage });

      if (user.spendingLimit && user.hobbies && user.hobbies.length > 0) {
        await bot.sendMessage(chatId, 'Мы готовим для вас рекомендации. Они начнут приходить очень скоро!');
        await bot.sendMessage(chatId, `Привет ${user.userName}! Чем могу помочь?`);

        const events = await EventModel.find();
        const CHUNK_SIZE = 20;
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
        await User.findByIdAndUpdate(user._id, { recommendations: user.recommendations });

        await bot.sendMessage(chatId, 'Ваши ивенты готовы! Давайте сделаем ваш отдых интересней!', {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Let's goo 🚀", callback_data: 'lets_goo' }, { text: "Избранные 🌟", callback_data: 'favorite_events' }],
              [{ text: "Мои данные 📚", callback_data: 'my_data' }]
            ]
          }
        });
      } else {
        const budgetMessage = 'Для начала выберите ваш бюджет:';
        await bot.sendMessage(chatId, budgetMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '0 - 5000 тенге', callback_data: 'budget_5000' }, { text: '5000 - 10000 тенге', callback_data: 'budget_10000' }],
              [{ text: '10000 - 20000 тенге', callback_data: 'budget_20000' }, { text: '20000 - 30000 тенге', callback_data: 'budget_30000' }],
              [{ text: '30000 - 40000 тенге', callback_data: 'budget_40000' }, { text: '40000 - 50000 тенге', callback_data: 'budget_50000' }],
              [{ text: '50000+ тенге', callback_data: 'budget_100000' }]
            ]
          }
        });
      }
    }
  }
};

export const handleMenu = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Выберите действие:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Let's goo 🚀", callback_data: 'lets_goo' }, { text: "Избранные 🌟", callback_data: 'favorite_events' }],
        [{ text: "Мои данные 📚", callback_data: 'my_data' }]
      ]
    }
  });
};

export const handleChangeBudget = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });

  if (!user) {
    await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь, используя команду /start.');
    return;
  }

  userSetupStages[chatId] = { stage: 0, field: 'budget' };

  const keyboard = [
    [{ text: '0 - 5000 тенге', callback_data: 'budget_5000' }, { text: '5000 - 10000 тенге', callback_data: 'budget_10000' }],
    [{ text: '10000 - 20000 тенге', callback_data: 'budget_20000' }, { text: '20000 - 30000 тенге', callback_data: 'budget_30000' }],
    [{ text: '30000 - 40000 тенге', callback_data: 'budget_40000' }, { text: '40000 - 50000 тенге', callback_data: 'budget_50000' }],
    [{ text: '50000+ тенге', callback_data: 'budget_100000' }]
  ];

  const selectedBudget = user.spendingLimit;
  const updatedKeyboard = keyboard.map(row =>
    row.map(button => ({
      ...button,
      text: button.callback_data === `budget_${selectedBudget}` ? `✅ ${button.text}` : button.text
    }))
  );

  await bot.sendMessage(chatId, 'Пожалуйста, выберите ваш новый бюджет:', {
    reply_markup: {
      inline_keyboard: updatedKeyboard
    }
  });
};

export const handleChangeHobbies = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });

  if (!user) {
    await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь, используя команду /start.');
    return;
  }

  userSetupStages[chatId] = { stage: 0, field: 'hobbies' };

  // Загружаем текущие предпочтения пользователя
  const selectedHobbies = user.hobbies || [];

  await bot.sendMessage(chatId, 'Пожалуйста, выберите ваши увлечения:', {
    reply_markup: createHobbiesKeyboard(selectedHobbies)
  });
};

export const handleChangePreferences = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Что вы хотите изменить?', {
    reply_markup: createPreferencesMenu()
  });
};

export const handleViewData = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });

  if (!user) {
    await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь, используя команду /start.');
    return;
  }

  const preferencesMessage = `Ваши текущие данные:
  
Имя пользователя: ${user.userName}
Бюджет: ${user.spendingLimit || 'не указан'}
Увлечения: ${user.hobbies?.join(', ') || 'не указаны'}
`;
  await bot.sendMessage(chatId, preferencesMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Изменить бюджет 💰", callback_data: 'change_budget' }, { text: "Изменить увлечения 🎨", callback_data: 'change_hobbies' }],
      ]
    }
  });
};

export const handleReferral = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const referralLink = `${TG_URL}?start=${chatId}`;
  await bot.sendMessage(chatId, `Пригласите друзей и получите бонусы! Вот ваша реферальная ссылка: ${referralLink}`);
};

export const handleCallbackQuery = async (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;

  if (!chatId) return;

  const action = callbackQuery.data;
  console.log(`Received callback_query: ${action} from chatId: ${chatId}`);

  const user = await User.findOne({ chatId });
  if (!user) return;

  const messageText = callbackQuery.message?.text || "Нет текста для редактирования";

  if (action.startsWith('budget_')) {
    const budget = parseInt(action.replace('budget_', ''));
    user.spendingLimit = budget;
    await User.findByIdAndUpdate(user._id, { spendingLimit: budget });

    if (user.hobbies && user.hobbies.length > 0) {
      // Если у пользователя уже есть предпочтения, не просим менять хобби
      delete userSetupStages[chatId];
      await bot.editMessageText('Ваш бюджет сохранен.', {
        chat_id: chatId,
        message_id: callbackQuery.message?.message_id,
      });
    } else {
      // Если предпочтений нет, просим выбрать хобби
      userSetupStages[chatId] = { stage: 0, field: 'hobbies' };
      await bot.editMessageText('Ваш бюджет сохранен. Пожалуйста, выберите ваши увлечения:', {
        chat_id: chatId,
        message_id: callbackQuery.message?.message_id,
        reply_markup: createHobbiesKeyboard([])
      });
    }
  } else if (action.startsWith('hobby_')) {
    const hobby = action;
    if (!user.hobbies) user.hobbies = [];
    const hobbyIndex = user.hobbies.indexOf(hobby);
    if (hobbyIndex === -1) {
      user.hobbies.push(hobby);
    } else {
      user.hobbies.splice(hobbyIndex, 1);
    }

    // Обновляем клавиатуру сразу, не дожидаясь ответа от БД
    const newKeyboard = createHobbiesKeyboard(user.hobbies);
    await bot.editMessageReplyMarkup(newKeyboard, { chat_id: chatId, message_id: callbackQuery.message?.message_id });
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ваши увлечения обновлены!' });

    // Обновляем данные в БД
    await User.findByIdAndUpdate(user._id, { hobbies: user.hobbies });

  } else if (action === 'hobbies_done') {
    delete userSetupStages[chatId];
    await bot.editMessageText(`Отлично! Мы сохранили ваши данные. Пока рекомендации грузятся, я могу отвечать на твои вопросы 😄 Можешь спросить про ивенты или в целом вопросы, которые тебя интересуют!

A если ожидание привысило 5 минут то нажмите заново /start.`, 
        { chat_id: chatId, message_id: callbackQuery.message?.message_id });
        await bot.sendMessage(chatId, 'Привет! Чем могу помочь?');
    // Запуск получения рекомендаций
    try {
      const events = await EventModel.find();
      const CHUNK_SIZE = 20;
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
      await User.findByIdAndUpdate(user._id, { recommendations: user.recommendations });

      await bot.sendMessage(chatId, 'Ваши ивенты готовы! Давайте сделаем ваш отдых интересней!', {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Let's goo 🚀", callback_data: 'lets_goo' }, { text: "Избранные ивенты 🌟", callback_data: 'favorite_events' }],
            [{ text: "Мои данные 📚", callback_data: 'my_data' }]
          ]
        }
      });

    } catch (error) {
      console.error(`Ошибка при получении рекомендаций для chatId ${chatId}:`, error);
      await bot.sendMessage(chatId, '❌ Извините, произошла ошибка при получении рекомендаций. Свяжитесь с @us_sun');
    }
  } else if (action === 'change_budget') {
    userSetupStages[chatId] = { stage: 0, field: 'budget' };
    await bot.sendMessage(chatId, 'Пожалуйста, выберите ваш новый бюджет:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '0 - 5000 тенге', callback_data: 'budget_5000' }, { text: '5000 - 10000 тенге', callback_data: 'budget_10000' }],
          [{ text: '10000 - 20000 тенге', callback_data: 'budget_20000' }, { text: '20000 - 30000 тенге', callback_data: 'budget_30000' }],
          [{ text: '30000 - 40000 тенге', callback_data: 'budget_40000' }, { text: '40000 - 50000 тенге', callback_data: 'budget_50000' }],
          [{ text: '50000+ тенге', callback_data: 'budget_100000' }]
        ]
      }
    });
  } else if (action === 'change_hobbies') {
    userSetupStages[chatId] = { stage: 0, field: 'hobbies' };
    await bot.sendMessage(chatId, 'Пожалуйста, выберите ваши новые увлечения:', {
      reply_markup: createHobbiesKeyboard(user.hobbies || [])
    });
  } else if (action === 'view_preferences') {
    const preferencesMessage = `Ваши текущие данные:
    
Имя пользователя: ${user.userName}
Бюджет: ${user.spendingLimit || 'не указан'}
Увлечения: ${user.hobbies?.join(', ') || 'не указаны'}
`;
    await bot.sendMessage(chatId, preferencesMessage);
  } else if (action === 'next_event') {
    await sendNextEvent(chatId);
  } else if (action === 'next_generated_event') {
    await sendNextGeneratedEvent(chatId);
  } else if (action === 'lets_goo') {
    await sendNextEvent(chatId);
  } else if (action === 'favorite_events') {
    if (user.likedEvents && user.likedEvents.length > 0) {
      for (const likedEvent of user.likedEvents) {
        if (likedEvent.message) {
          await bot.sendMessage(chatId, likedEvent.message, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Купить билеты", url: likedEvent.ticketLink }]
              ]
            }
          });
        }
      }
    } else {
      await bot.sendMessage(chatId, 'У вас нет избранных ивентов.');
    }
  } else if (action === 'my_data') {
    await bot.sendMessage(chatId, `Ваши текущие данные:
    
Имя пользователя: ${user.userName}
Бюджет: ${user.spendingLimit || 'не указан'}
Увлечения: ${user.hobbies?.join(', ') || 'не указаны'}
`, {
  reply_markup: {
    inline_keyboard: [
      [{ text: "Изменить бюджет 💰", callback_data: 'change_budget' }, { text: "Изменить увлечения 🎨", callback_data: 'change_hobbies' }],
    ]
  }
});
  } else if (action.startsWith('like_event')) {
    const ticketLink = decodeURIComponent(action.replace('like_event_', ''));
    const event = await EventModel.findOne({ ticketLink: new RegExp(ticketLink) });
    if (event) {
      user.likedEvents = user.likedEvents || [];
      user.likedEvents.push({ title: event.title, date: event.date || '', message: callbackQuery.message?.text || '', ticketLink: event.ticketLink || '' });
      await User.findByIdAndUpdate(user._id, { likedEvents: user.likedEvents });
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Отлично! Вы можете посмотреть понравившиеся ивенты в избранных' });
    }
    await sendNextEvent(chatId);
  } else if (action.startsWith('like_generated_event')) {
    const ticketLink = decodeURIComponent(action.replace('like_generated_event_', ''));
    const event = await EventModel.findOne({ ticketLink: new RegExp(ticketLink) });
    if (event) {
      user.likedEvents = user.likedEvents || [];
      user.likedEvents.push({ title: event.title, date: event.date || '', message: callbackQuery.message?.text || '', ticketLink: event.ticketLink || '' });
      await User.findByIdAndUpdate(user._id, { likedEvents: user.likedEvents });
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Отлично! Вы можете посмотреть понравившиеся ивенты в избранных' });
    }
    await sendNextGeneratedEvent(chatId);
  } else if (action.startsWith('dislike_event')) {
    const ticketLink = decodeURIComponent(action.replace('dislike_event_', ''));
    const event = await EventModel.findOne({ ticketLink: new RegExp(ticketLink) });
    if (event) {
      user.dislikedEvents = user.dislikedEvents || [];
      user.dislikedEvents.push({ title: event.title, date: event.date || '', message: callbackQuery.message?.text || '', ticketLink: event.ticketLink || '' });
      await User.findByIdAndUpdate(user._id, { dislikedEvents: user.dislikedEvents });
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Мы реже будем предлагать подобные ивенты.' });
      await bot.deleteMessage(chatId, callbackQuery.message?.message_id || '');
    }
    await sendNextEvent(chatId);
  }

  bot.answerCallbackQuery(callbackQuery.id);
};

export const handleMenuCommand = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  await handleMenu(bot, msg);
};

export const handleViewFavorites = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });

  if (!user) {
    await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь, используя команду /start.');
    return;
  }

  if (user.likedEvents && user.likedEvents.length > 0) {
    for (const likedEvent of user.likedEvents) {
      if (likedEvent.message) {
        await bot.sendMessage(chatId, likedEvent.message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Купить билеты", url: likedEvent.ticketLink }]
            ]
          }
        });
      }
    }
  } else {
    await bot.sendMessage(chatId, 'У вас нет избранных ивентов.');
  }
};

export const handleStopSession = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });

  if (!user) {
    await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь, используя команду /start.');
    return;
  }

  user.stopSession = true;
  await User.findByIdAndUpdate(user._id, { stopSession: true });

  await bot.sendMessage(chatId, 'Сессия остановлена. Вы больше не будете получать рекомендации.');
};

import TelegramBot from 'node-telegram-bot-api';
import { getEventChunks, getRecommendations } from './recomendation';
import User, { IUser } from './user/models/User';
import 'dotenv/config';
import buyTickets from './buyTickets';
import EventModel, { IEvent } from './event/models/Event';
import cron from 'node-cron';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { SpeechClient } from '@google-cloud/speech';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import axios from 'axios';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN_DEV || '';
if (!TELEGRAM_TOKEN) {
  throw new Error('TELEGRAM_TOKEN is not set');
}

const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_API_KEY,
});

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
console.log('Telegram bot started');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME!;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pinecone.Index(PINECONE_INDEX_NAME);

interface UserPreferences {
  spendingLimit?: number;
  hobbies?: string[];
  userName?: string;
  recommendations?: string[];
  lastRecommendationIndex?: number;
  generatedPosts?: any[];
  lastGeneratedPostIndex?: number;
  pendingTicketPurchase?: {
    url: string;
    chatId: string;
  };
}

const userSetupStages: { [chatId: string]: { stage: number, field?: string } } = {};

const availableCommands = ['/start', '/change_budget', '/change_hobbies', '/stop_session', '/next_event', '/view_preferences'];

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.username || '';
  const firstName = msg.from?.first_name || '';
  console.log('username', userName);

  const uniqueUserId = userName || firstName || `user_${chatId}`;

  if (uniqueUserId) {
    let user = await User.findOne({ userName: uniqueUserId });
    if (!user) {
      user = await User.findOne({ userName: firstName });
    }
    if (!user) {
      user = new User({
        userName: uniqueUserId,
        chatId,
        recommendations: [],
        lastRecommendationIndex: 0,
        generatedPosts: [],
        lastGeneratedPostIndex: 0,
        stopSession: false
      });
      await user.save();
      userSetupStages[chatId] = { stage: 0, field: 'budget' };

      await bot.sendMessage(chatId, `👋 Добро пожаловать, ${firstName}, в Seruen!
      
Мы очень рады, что вы присоединились к нам. Давайте немного познакомимся, и мы будем присылать вам персонализированные рекомендации по мероприятиям в вашем городе! 

Для начала выберите ваш бюджет:`, {
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

Вы можете спрашивать, куда можно сходить или предложить ивенты.`;

      await bot.sendMessage(chatId, welcomeMessage);
      await bot.sendMessage(chatId, 'Мы готовим для вас рекомендации. Они начнут приходить очень скоро!', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Изменить бюджет', callback_data: 'change_budget' }],
            [{ text: 'Изменить увлечения', callback_data: 'change_hobbies' }],
            [{ text: 'Посмотреть мои данные', callback_data: 'view_preferences' }]
          ]
        }
      });

      try {
        await bot.sendChatAction(chatId, 'typing');
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
        await User.findByIdAndUpdate(user._id, { recommendations: user.recommendations });

        await bot.sendMessage(chatId, '✨ Мы завершили подготовку ваших рекомендаций. Наслаждайтесь мероприятиями!');

        await sendNextEvent(chatId);

      } catch (error) {
        console.error(`Ошибка при получении рекомендаций для chatId ${chatId}:`, error);
        await bot.sendMessage(chatId, '❌ Извините, произошла ошибка при получении рекомендаций.');
      }
    }
  }
});

bot.onText(/\/change_budget/, async (msg) => {
  const chatId = msg.chat.id;
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
    await User.findByIdAndUpdate(user._id, { stopSession: true });
  }
  delete userSetupStages[chatId];
  await bot.sendMessage(chatId, '🛑 Сеанс завершен. Если захотите начать снова, используйте команду /start.');
});

bot.onText(/\/next_event/, async (msg) => {
  const chatId = msg.chat.id;
  await sendNextEvent(chatId);
});

bot.onText(/\/view_preferences/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });
  if (user) {
    const preferencesMessage = `Ваши текущие данные:
    
Имя пользователя: ${user.userName}
Бюджет: ${user.spendingLimit || 'не указан'}
Увлечения: ${user.hobbies?.join(', ') || 'не указаны'}
`;

    await bot.sendMessage(chatId, preferencesMessage);
  } else {
    await bot.sendMessage(chatId, 'Не удалось найти ваши данные. Пожалуйста, зарегистрируйтесь снова, используя команду /start.');
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;

  if (!chatId) return;

  const action = callbackQuery.data;
  console.log(`Received callback_query: ${action} from chatId: ${chatId}`);

  if (action.startsWith('budget_')) {
    const budget = parseInt(action.replace('budget_', ''));
    const user = await User.findOne({ chatId });
    if (user) {
      user.spendingLimit = budget;
      await User.findByIdAndUpdate(user._id, { spendingLimit: budget });
      if (!user.hobbies || user.hobbies.length === 0) {
        userSetupStages[chatId] = { stage: 1, field: 'hobbies' };
        await bot.sendMessage(chatId, 'Ваш бюджет обновлен. Теперь введите ваши увлечения (через запятую):');
      } else {
        delete userSetupStages[chatId];
        await bot.sendMessage(chatId, 'Ваш бюджет обновлен.');
      }
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
    await bot.sendMessage(chatId, 'Пожалуйста, введите ваши новые увлечения (через запятую):');
  } else if (action === 'view_preferences') {
    const user = await User.findOne({ chatId });
    if (user) {
      const preferencesMessage = `Ваши текущие данные:
      
Имя пользователя: ${user.userName}
Бюджет: ${user.spendingLimit || 'не указан'}
Увлечения: ${user.hobbies?.join(', ') || 'не указаны'}
`;

      await bot.sendMessage(chatId, preferencesMessage);
    } else {
      await bot.sendMessage(chatId, 'Не удалось найти ваши данные. Пожалуйста, зарегистрируйтесь снова, используя команду /start.');
    }
  } else if (action === 'next_event') {
    await sendNextEvent(chatId);
  } else if (action === 'next_generated_event') {
    await sendNextGeneratedEvent(chatId);
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text;
  const user = await User.findOne({ chatId });

  if (!user) {
    if (msg.text !== '/start') {
      console.log(msg);
      await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь, используя команду /start.');
    }
    return;
  }

  if (userText.startsWith('/')) {
    if (!availableCommands.includes(userText)) {
      await bot.sendMessage(chatId, 'Неизвестная команда. Доступные команды:\n/start\n/change_budget\n/change_hobbies\n/stop_session\n/next_event\n/view_preferences');
    }
    return;
  }

  if (!(chatId in userSetupStages)) {
    try {
      bot.sendChatAction(chatId, 'typing');
      const classificationResult = await classifyAndEnhanceMessage(userText);

      if (classificationResult.isRelated) {
        await bot.sendMessage(chatId, 'Начался поиск в базе данных по вашему запросу...');
        console.log('User message is related:', classificationResult.response);

        const userEmbedding = await getEmbedding(classificationResult.response, user);
        const queryResponse = await index.query({
          vector: userEmbedding,
          topK: 100,
          includeMetadata: true,
        });

        if (queryResponse && queryResponse.matches && queryResponse.matches.length > 0) {
          const topResults = queryResponse.matches.map(match => match.metadata?.title).filter(Boolean);

          if (topResults.length > 0) {
            const mongoEvents = await EventModel.find({ title: { $in: topResults } });

            const formattedEvents = await getRecommendations(mongoEvents, { ...user, userPrompt: userText });

            if (formattedEvents.length > 0) {
              user.generatedPosts = formattedEvents;
              user.lastGeneratedPostIndex = 0;
              await User.findByIdAndUpdate(user._id, { generatedPosts: user.generatedPosts, lastGeneratedPostIndex: user.lastGeneratedPostIndex });

              await sendNextGeneratedEvent(chatId);
            } else {
              await bot.sendMessage(chatId, 'К сожалению, я не смог найти подходящие ивенты.');
            }
          } else {
            await bot.sendMessage(chatId, 'К сожалению, я не смог найти подходящие ивенты.');
          }
        } else {
          await bot.sendMessage(chatId, 'К сожалению, я не смог найти подходящие ивенты.');
        }
      } else {
        console.log('User message is not related:', classificationResult.response);

        await bot.sendMessage(chatId, classificationResult.response);
      }
    } catch (error) {
      console.error('Error processing user message:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз позже.');
    }
    return;
  }

  const { stage, field } = userSetupStages[chatId];

  switch (field) {
    case 'budget':
      user.spendingLimit = parseInt(userText!);
      await User.findByIdAndUpdate(user._id, { spendingLimit: user.spendingLimit });
      userSetupStages[chatId] = { stage: 1, field: 'hobbies' };
      await bot.sendMessage(chatId, 'Ваш бюджет сохранен. Теперь введите ваши увлечения (через запятую):');
      break;
    case 'hobbies':
      user.hobbies = userText!.split(',').map(item => item.trim());
      await User.findByIdAndUpdate(user._id, { hobbies: user.hobbies });
      delete userSetupStages[chatId];
      await bot.sendMessage(chatId, 'Спасибо! Ваши данные сохранены. Получаем ваши персонализированные рекомендации...');
      await bot.sendMessage(chatId, 'Пока рекомендации грузятся, я могу отвечать на твои вопросы 😄 Можешь спросить про ивенты или в целом вопросы, которые тебя интересуют!');
      break;
    default:
      break;
  }

  if (!field) {
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
      await User.findByIdAndUpdate(user._id, { recommendations: user.recommendations });

      await bot.sendMessage(chatId, '✨ Мы завершили подготовку ваших рекомендаций. Наслаждайтесь мероприятиями!');

      await sendNextEvent(chatId);

    } catch (error) {
      console.error(`Ошибка при получении рекомендаций для chatId ${chatId}:`, error);
      await bot.sendMessage(chatId, '❌ Извините, произошла ошибка при получении рекомендаций.');
    }
  }
});

const sendNextEvent = async (chatId: number) => {
  const user = await User.findOne({ chatId });

  if (!user || !user.recommendations || user.recommendations.length === 0) {
    await bot.sendMessage(chatId, 'У вас нет рекомендаций. Пожалуйста, сначала получите рекомендации.');
    return;
  }

  if (user.stopSession) {
    return;
  }

  const chatExists = await checkChatExistence(chatId);
  if (!chatExists) {
    return;
  }

  const nextEvent = user.recommendations[user.lastRecommendationIndex || 0];

  if (!nextEvent) {
    await bot.sendMessage(chatId, 'Мероприятия которые подходят под ваш запрос закончились. Вы можете ввести другой запрос!');
    return;
  }

  await bot.sendMessage(chatId, nextEvent.message.replace(/\\n/g, '\n'), {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Купить билеты", url: nextEvent.ticketLink }],
        [{ text: "🔜 Следующий ивент", callback_data: 'next_event' }]
      ]
    }
  });
  user.lastRecommendationIndex = (user.lastRecommendationIndex ?? 0) + 1;
  await User.findByIdAndUpdate(user._id, { lastRecommendationIndex: user.lastRecommendationIndex });
};

const sendNextGeneratedEvent = async (chatId: number) => {
  const user = await User.findOne({ chatId });

  if (!user || !user.generatedPosts || user.generatedPosts.length === 0) {
    await bot.sendMessage(chatId, 'У вас нет сгенерированных ивентов. Пожалуйста, сначала получите рекомендации.');
    return;
  }

  if (user.stopSession) {
    return;
  }

  const nextEvent = user.generatedPosts[user.lastGeneratedPostIndex || 0];

  if (!nextEvent || !nextEvent.message) {
    await bot.sendMessage(chatId, 'Больше нет сгенерированных мероприятий для показа.');
    return;
  }

  await bot.sendMessage(chatId, `🔵 ${nextEvent.message.replace(/\\n/g, '\n')}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Купить билеты", url: nextEvent.ticketLink }],
        [{ text: "🔜 Следующий сгенерированный ивент", callback_data: 'next_generated_event' }]
      ]
    }
  });
  user.lastGeneratedPostIndex = (user.lastGeneratedPostIndex ?? 0) + 1;
  await User.findByIdAndUpdate(user._id, { lastGeneratedPostIndex: user.lastGeneratedPostIndex });
};

cron.schedule('0 9,14,20 * * *', async () => {
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

export const  notifyAll = async () => {
  console.log('Запуск планировщика для отправки рекомендаций пользователям');
  try {
    await bot.sendMessage(1085266656), 'Я научился разговаривать с вами! Попробуйте спросить меня что-нибудь.');
    // const users = await User.find();
    // for (const user of users) {
    //   if (!user.stopSession) {
    //     await bot.sendMessage(Number(user.chatId), 'Я научился разговаривать с вами! Попробуйте спросить меня что-нибудь.');
    //   }
    // }
  } catch (error) {
    console.error('Ошибка при отправке плановых рекомендаций:', error);
  }

}


const checkChatExistence = async (chatId) => {
  try {
    await bot.getChat(chatId);
    return true;
  } catch (error) {
    console.error(`Chat with ID ${chatId} not found or bot is removed from it:`, error);
    return false;
  }
};

const getEmbedding = async (content: string | undefined, user: any): Promise<number[]> => {
  const userPreferences = `
    Бюджет: ${user.spendingLimit ?? 'не указан'}
    Увлечения: ${user.hobbies?.join(', ') ?? 'не указаны'}
  `;
  const input = `${content}\n\nПользовательские предпочтения:\n${userPreferences}`;
  console.log('Embedding input:', input);
  

  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: input,
  });

  if (response.data && response.data[0] && response.data[0].embedding) {
    return response.data[0].embedding;
  } else {
    throw new Error('Invalid response from OpenAI API');
  }
};

const classifyAndEnhanceMessage = async (message: string): Promise<{ isRelated: boolean | undefined, response: string | undefined }> => {
  const currentDate = new Date().toISOString().split('T')[0]; 
  
  const systemPrompt = `Вы являетесь помощником по рекомендациям мероприятий в Алматы, разработчик которого является Уштаев Асанали, вот его телеграм: @us_sun(если они спросят), инстаграм: us_a.sun. . В векторной базе данных содержатся события и мероприятия, происходящие в Алматы. Если пользователь просит рекомендации по мероприятиям, ответьте JSON-объектом {"isRelated": true, "response": "улучшенный запрос для векторной базы данных"}. Если нет, ответьте JSON-объектом {"isRelated": false, "response": "подходящий ответ"}.

        Если пользователь спрашивает о мероприятиях на конкретные даты или упоминает такие термины, как "завтра", определите точную дату, на которую он ссылается, и включите ее в улучшенный запрос добавив туда: "сегодняшяя дата ${currentDate}". В таких случаях находи мероприятия строго по дате.

        Не включайте пустые поля в ответ JSON.

        Пример 1:
        Пользователь: "Можете порекомендовать какие-нибудь мероприятия в Алматы на этих выходных?"
        Помощник: {"isRelated": true, "response": "Рекомендуйте мероприятия, проходящие в Алматы на этих выходных"}

        Пример 2:
        Пользователь: "Что мне надеть на официальное мероприятие?"
        Помощник: {"isRelated": false, "response": "На официальное мероприятие следует надеть костюм или вечернее платье."}

        Пример 3:
        Пользователь: "Есть ли какие-нибудь мероприятия завтра?"
        Помощник: {"isRelated": true, "response": "Рекомендуйте мероприятия, проходящие в Алматы завтра"}
        `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]
  });

  const answer = response.choices[0].message.content?.trim();
  console.log('OpenAI response:', answer);
  
  try {
    const jsonResponse = answer ? JSON.parse(answer.replace(/```json|```/g, '').trim()) : undefined;
    return { isRelated: jsonResponse.isRelated, response: jsonResponse.response };
  } catch (error) {
    console.error('Error parsing JSON response from GPT:', error);
    return { isRelated: false, response: 'Извините, произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз позже.' };
  }
};


bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.voice.file_id;

  try {
    const fileLink = await bot.getFileLink(fileId);
    const audioPath = `./voice_${fileId}.ogg`;

    // Скачиваем голосовое сообщение
    const response = await axios({
      method: 'get',
      url: fileLink,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(audioPath);
    response.data.pipe(writer);

    writer.on('finish', async () => {
      // Конвертация OGG файла в FLAC для Google Speech-to-Text
      const flacPath = audioPath.replace('.ogg', '.flac');
      await convertOggToFlac(audioPath, flacPath);

      const audio = fs.readFileSync(flacPath);
      const audioBytes = audio.toString('base64');

      const request = {
        audio: { content: audioBytes },
        config: {
          encoding: 'FLAC' as const,
          sampleRateHertz: 16000,
          languageCode: 'ru-RU',
        },
      };

      const [response] = await speechClient.recognize(request);

      const transcription = response.results
        ?.map(result => result.alternatives?.[0]?.transcript)
        .join('\n');

      // Отправляем распознанный текст в чат
      await bot.sendMessage(chatId, `Распознанный текст: ${transcription}`);

      // Удаляем временные файлы
      fs.unlinkSync(audioPath);
      fs.unlinkSync(flacPath);
    });

    writer.on('error', () => {
      bot.sendMessage(chatId, 'Ошибка при загрузке голосового сообщения');
    });
  } catch (error) {
    console.error('Error processing voice message:', error);
    bot.sendMessage(chatId, 'Ошибка при обработке голосового сообщения');
  }
});

async function convertOggToFlac(inputPath: string, outputPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('flac')
      .on('end', () => resolve())
      .on('error', err => reject(err))
      .save(outputPath);
  });
}

export default bot;

import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import User from './user/models/User';
import EventModel from './event/models/Event';
import { OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME } from './config';
import bot from './bot';
import { text } from 'stream/consumers';
import { getRecommendations } from './recomendation';

const MAX_CALLBACK_DATA_LENGTH = 64;

export const availableCommands = ['/start', '/change_budget', '/menu', '/change_hobbies', '/change_preferences','/view_favorites', '/view_data','/stop_session', '/next_event', '/view_preferences', '/ref'];

export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
export const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
export const index = pinecone.Index(PINECONE_INDEX_NAME);

export const userSetupStages: { [chatId: string]: { stage: number, field?: string } } = {};

export const getEmbedding = async (content: string | undefined, user: any): Promise<number[]> => {
  const input = `${content}`;
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

export const classifyAndEnhanceMessage = async (message: string): Promise<{ isRelated: boolean | undefined, response: string | undefined }> => {
  const currentDate = new Date().toISOString().split('T')[0];

  const systemPrompt = `Вы являетесь помощником по рекомендациям мероприятий в Алматы, разработчик которого является Уштаев Асанали, вот его телеграм: @us_sun(если они спросят), инстаграм: us_a.sun. . В векторной базе данных содержатся события и мероприятия, происходящие в Алматы. Если пользователь просит рекомендации по мероприятиям, ответьте JSON-объектом {"isRelated": true, "response": "улучшенный запрос для векторной базы данных"}. Если нет, ответьте JSON-объектом {"isRelated": false, "response": "подходящий ответ"}.

        Если пользователь спрашивает о мероприятиях на конкретные даты или упоминает такие термины, как "завтра", определите точную дату, на которую он ссылается, и включите ее в улучшенный запрос добавив туда: "сегодняшняя дата ${currentDate}". В таких случаях находи мероприятия строго по дате.

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

export const getEventChunks = (events: any[], chunkSize: number) => {
  const chunks: any[][] = [];
  for (let i = 0; i < events.length; i += chunkSize) {
    chunks.push(events.slice(i, i + chunkSize));
  }
  return chunks;
};

export const createCallbackData = (action: string, data: string): string => {
  // Ограничим длину данных callback
  const encodedData = encodeURIComponent(data).slice(0, MAX_CALLBACK_DATA_LENGTH - action.length - 1);
  return `${action}_${encodedData}`;
};

export const sendNextEvent = async (chatId: number) => {
  const user = await User.findOne({ chatId });

  if (!user || !user.recommendations || user.recommendations.length === 0) {
    await bot.sendMessage(chatId, 'У вас нет рекомендаций. Пожалуйста, сначала получите рекомендации.');
    return;
  }

  const currentDate = new Date();
  const lastUpdatedDate = new Date(user.lastRecommendationUpdate || 0);
  console.log(lastUpdatedDate);
  

  const diffTime = Math.abs(currentDate.getTime() - lastUpdatedDate.getTime());
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));

  if (diffHours > 24) {
    await bot.sendMessage(chatId, 'Ваши рекомендации устарели. Пожалуйста, обновите их, используя команду /start.');
    return;
  }

  if (user.stopSession) {
    return;
  }

  const chatExists = await checkChatExistence(Number(user.chatId));
  if (!chatExists) {
    return;
  }

  const nextEvent = user.recommendations[user.lastRecommendationIndex || 0];

  if (!nextEvent) {
    await bot.sendMessage(chatId, 'Мероприятия которые подходят под ваш запрос закончились. Вы можете ввести другой запрос!');
    return;
  }

  const likeCallbackData = createCallbackData('like_event', nextEvent.ticketLink);
  const dislikeCallbackData = createCallbackData('dislike_event', nextEvent.ticketLink);

  await bot.sendMessage(chatId, nextEvent.message.replace(/\\n/g, '\n'), {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Не нравится 👎", callback_data: dislikeCallbackData },  {text: "Нравится ❤️", callback_data: likeCallbackData }],
        [{text: "Следующий ивент 🤩", callback_data: 'next_event'}]
      ]
    }
  });
  user.lastRecommendationIndex = (user.lastRecommendationIndex ?? 0) + 1;
  await User.findByIdAndUpdate(user._id, { lastRecommendationIndex: user.lastRecommendationIndex });
};

export const sendNextGeneratedEvent = async (chatId: number) => {
  const user = await User.findOne({ chatId });

  if (!user || !user.generatedPosts || user.generatedPosts.length === 0) {
    await bot.sendMessage(chatId, 'У вас нет сгенерированных ивентов. Пожалуйста, сначала получите рекомендации. Можете поискать что то другое!');
    return;
  }

  if (user.stopSession) {
    return;
  }

  const nextEvent = user.generatedPosts[user.lastGeneratedPostIndex || 0];

  if (!nextEvent || !nextEvent.message) {
    await bot.sendMessage(chatId, 'Больше нет мероприятий под ваш запрос. Вы можете ввести другой запрос');
    return;
  }

  const likeCallbackData = createCallbackData('like_generated_event', nextEvent.ticketLink);
  const dislikeCallbackData = createCallbackData('dislike_event', nextEvent.ticketLink);

  await bot.sendMessage(chatId, `🔵 ${nextEvent.message.replace(/\\n/g, '\n')}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Не нравится 👎", callback_data: dislikeCallbackData },  {text: "Нравится ❤️", callback_data: likeCallbackData }],
        [{text: "Следующий ивент под мой запрос 🤩", callback_data: 'next_generated_event'}]
      ]
    }
  });
  user.lastGeneratedPostIndex = (user.lastGeneratedPostIndex ?? 0) + 1;
  await User.findByIdAndUpdate(user._id, { lastGeneratedPostIndex: user.lastGeneratedPostIndex });
};

export const checkChatExistence = async (chatId: number) => {
  try {
    await bot.getChat(chatId);
    return true;
  } catch (error) {
    console.error(`Chat with ID ${chatId} not found or bot is removed from it:`, error);
    return false;
  }
};

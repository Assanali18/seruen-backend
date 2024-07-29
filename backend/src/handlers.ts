import TelegramBot from 'node-telegram-bot-api';
import { handleStart, handleChangeBudget, handleChangeHobbies, handleChangePreferences, handleCallbackQuery, handleMenu, handleViewData, handleViewFavorites, handleStopSession, handleReferral } from './commands';
import User from './user/models/User';
import EventModel from './event/models/Event';
import { classifyAndEnhanceMessage, getEmbedding, sendNextEvent, sendNextGeneratedEvent, availableCommands, userSetupStages, index, getEventChunks } from './util';
import { getRecommendations } from './recomendation';
import { createHobbiesKeyboard } from './keyboard';

export const initHandlers = (bot: TelegramBot) => {
  bot.onText(/\/start/, (msg) => handleStart(bot, msg));
  bot.onText(/\/change_budget/, (msg) => handleChangeBudget(bot, msg));
  bot.onText(/\/change_hobbies/, (msg) => handleChangeHobbies(bot, msg));
  bot.onText(/\/change_preferences/, (msg) => handleChangePreferences(bot, msg));
  bot.onText(/\/view_favorites/, (msg) => handleViewFavorites(bot, msg));
  bot.onText(/\/stop_session/, (msg) => handleStopSession(bot, msg));
  bot.onText(/\/menu/, (msg) => handleMenu(bot, msg));
  bot.onText(/\/view_data/, (msg) => handleViewData(bot, msg));
  bot.onText(/\/ref/, (msg) => handleReferral(bot, msg)); 
  bot.on('callback_query', (callbackQuery) => handleCallbackQuery(bot, callbackQuery));
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userText = msg.text;
    const user = await User.findOne({ chatId });

    if (!user) {
      if (!msg.text.startsWith('/start')) {
        console.log(msg);
        await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь, используя команду /start.');
      }
      return;
    }

    if (userText.startsWith('/')) {
      if (!availableCommands.includes(userText)) {
        await bot.sendMessage(chatId, 'Неизвестная команда. Доступные команды:\n/start\n/change_budget\n/change_hobbies\n/stop_session\n/next_event\n/view_preferences\n/ref\n/menu\n/view_favorites\n/view_data');
      }
      return;
    }

    if (!(chatId in userSetupStages)) {
      try {
        bot.sendChatAction(chatId, 'typing');
        const classificationResult = await classifyAndEnhanceMessage(userText);

        if (classificationResult.isRelated) {
          await bot.sendMessage(chatId, 'Начался поиск в базе данных по вашему запросу... ⏳ Если это займет слишком много времени, попробуйте изменить запрос. Или напишите @us_sun');
          console.log('User message is related:', classificationResult.response);

          const userEmbedding = await getEmbedding(classificationResult.response, user);
          const queryResponse = await index.query({
            vector: userEmbedding,
            topK: 150,
            includeMetadata: true,
          });

          if (queryResponse && queryResponse.matches && queryResponse.matches.length > 0) {
            const topResults = queryResponse.matches.map(match => match.metadata?.title).filter(Boolean);

            if (topResults.length > 0) {
              const mongoEvents = await EventModel.find({ title: { $in: topResults } });
              console.log('Mongo events:', mongoEvents.length);

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
      } catch (error: any) {
        console.error('Error processing user message:', error);
        await bot.sendMessage(chatId, `Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз позже.`);
      }
      return;
    }

    const { stage, field } = userSetupStages[chatId];

    switch (field) {
      case 'budget':
        user.spendingLimit = parseInt(userText!);
        await User.findByIdAndUpdate(user._id, { spendingLimit: user.spendingLimit });
        userSetupStages[chatId] = { stage: 1, field: 'hobbies' };
        await bot.sendMessage(chatId, 'Ваш бюджет сохранен. Теперь выберите ваши увлечения:', {
          reply_markup: createHobbiesKeyboard([])
        });
        break;
      case 'hobbies':
        user.hobbies = userText!.split(',').map(item => item.trim());
        await User.findByIdAndUpdate(user._id, { hobbies: user.hobbies });
        delete userSetupStages[chatId];
        await bot.sendMessage(chatId, 'Спасибо! Ваши данные сохранены. Мы готовим для вас ивенты под ваши предпочтения, подождите немножко, скоро мы отправим сообщение! Если ожидание привысило 5 минут, нажмите заново /start.');
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
        await bot.sendMessage(chatId, '❌ Извините, произошла ошибка при получении рекомендаций.');
      }
    }
  });
};

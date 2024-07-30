import User, { IUser } from './user/models/User';
import EventModel from './event/models/Event';
import cron from 'node-cron';
import bot from './bot';
import { checkChatExistence, createCallbackData } from './util';
import { sendEventList } from './commands';

cron.schedule('0 0 * * *', async () => {
  try {
    const users = await User.find();
    const currentDate = new Date();

    for (const user of users) {
      if (user.likedEvents) {
        const updatedLikedEvents: { title: string; date: string; message: string; ticketLink: string; }[] = []; 
        for (const likedEvent of user.likedEvents) {
          const eventDate = new Date(likedEvent.date);
          if (eventDate >= currentDate) {
            updatedLikedEvents.push(likedEvent);
          }
        }
        user.likedEvents = updatedLikedEvents;
        await user.save();
      }
    }
    console.log('Обновление списка понравившихся ивентов завершено.');
  } catch (error) {
    console.error('Ошибка при обновлении списка понравившихся ивентов:', error);
  }
});


const sendWeeklyEvents = async (user: IUser, events: { title: string; date: string; venue: string }[], startIndex = 0, step = 5) => {
  await sendEventList(user.chatId, events, startIndex, step);
};


const getWeeklyEvents = (user, isWeekend = false) => {
  const start = isWeekend ? 5 : 0;
  const end = isWeekend ? 7 : 5;

  return (user.recommendations || []).filter(event => {
    if (!event.date) return false; // Пропускаем события без даты
    const eventDate = parseDate(event.date);
    const currentDate = new Date();
    const daysDifference = (eventDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24);
    return daysDifference >= start && daysDifference < end;
  }).map(event => ({
    title: event.title,
    date: event.date,
    venue: event.venue
  }));
};



cron.schedule('0 9 * * 1', async () => {
  try {
    const users = await User.find();

    for (const user of users) {
      if (user.chatId) {
        const chatExists = await checkChatExistence(Number(user.chatId));
        if (!chatExists) continue;

        const weeklyEvents = getWeeklyEvents(user);
        if (weeklyEvents.length > 0) {
          await sendWeeklyEvents(user, weeklyEvents);
        }
      }
    }
  } catch (error) {
    console.error('Ошибка при отправке недельных мероприятий:', error);
  }
});


export const testFunction = async () => {
  try {
    const user = await User.findOne({ userName: 'us_sun' });
    if (user?.chatId) {
      const chatExists = await checkChatExistence(Number(user.chatId));
      if (!chatExists) {
        console.log('Chat does not exist');
        return;
      }

      const weeklyEvents = getWeeklyEvents(user);
      if (weeklyEvents.length > 0) {
        await sendWeeklyEvents(user, weeklyEvents);
      }
    }
  } catch (error) {
    console.error('Ошибка при отправке недельных мероприятий:', error);
  }
};

cron.schedule('0 9 * * 5', async () => {
  try {
    const users = await User.find();

    for (const user of users) {
      if (user.chatId) {
        const chatExists = await checkChatExistence(Number(user.chatId));
        if (!chatExists) continue;

        const weekendEvents = getWeeklyEvents(user, true);
        if (weekendEvents.length > 0) {
          await sendWeeklyEvents(user, weekendEvents);
        }
      }
    }
  } catch (error) {
    console.error('Ошибка при отправке мероприятий на выходные:', error);
  }
});

const parseDate = (dateStr) => {
  const [day, month, year] = dateStr.split('.');
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
};


// cron.schedule('0 8 * * *', async () => {
//   try {
//     const users = await User.find();

//     for (const user of users) {
//       if (user.chatId) {
//         const chatExists = await checkChatExistence(Number(user.chatId));
//         if (!chatExists) {
//           continue;
//         }
//         if (chatExists) {
//           const message = `🔥 Пригласите 10 друзей и получите 1000 тенге! Используйте вашу реферальную ссылку /ref и начните зарабатывать прямо сейчас! 🎉`;
//           await bot.sendMessage(Number(user.chatId), message);
//           console.log('Referral notification sent to:', user.userName);
//         }
//       }
      
//     }
//   } catch (error) {
//     console.error('Ошибка при отправке уведомления о реферальной программе:', error);
//   }
// });

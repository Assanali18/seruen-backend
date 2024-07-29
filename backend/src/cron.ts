import User from './user/models/User';
import EventModel from './event/models/Event';
import cron from 'node-cron';
import bot from './bot';
import { checkChatExistence } from './util';

cron.schedule('0 0 * * *', async () => {
  try {
    const users = await User.find();
    const currentDate = new Date();

    for (const user of users) {
      if (user.likedEvents) {
        const updatedLikedEvents: { title: string; date: string; message: string; ticketLink: string; }[] = []; // Объявляем тип как массив объектов
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

cron.schedule('0 9 * * *', async () => {
  try {
    const users = await User.find();

    for (const user of users) {
      if (user.chatId) {
        const chatExists = await checkChatExistence(Number(user.chatId));
        if (!chatExists) {
          return;
        }
        if (chatExists) {
          const message = `🔥 Пригласите 10 друзей и получите 1000 тенге! Используйте вашу реферальную ссылку /ref и начните зарабатывать прямо сейчас! 🎉`;
          await bot.sendMessage(Number(user.chatId), message);
          console.log('Referral notification sent to:', user.userName);
        }
      }
      
    }
  } catch (error) {
    console.error('Ошибка при отправке уведомления о реферальной программе:', error);
  }
});

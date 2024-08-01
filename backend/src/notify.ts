import bot from './bot';
import User from './user/models/User';
import { checkChatExistence } from './util';

export const notifyAll = async () => {
  console.log('Запуск планировщика для отправки рекомендаций пользователям');
  try {
    const users = await User.find();
    for (const user of users) {
      if (!user.stopSession) {
        const chatExists = await checkChatExistence(Number(user.chatId));
        if (chatExists) {
          await bot.sendMessage(Number(user.chatId), '🎁 Хотите 1000 тенге? Пригласите 10 друзей с помощью /ref! Делитесь ссылкой и получайте крутые бонусы. Не упустите шанс на больше веселья! 🎉💃');
          console.log('Notification sent to:', user.userName);

        }

      }
    }
  } catch (error) {
    console.error('Ошибка при отправке плановых рекомендаций:', error);
  }
};

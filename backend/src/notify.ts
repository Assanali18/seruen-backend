import bot from './bot';
import User from './user/models/User';

export const notifyAll = async () => {
  console.log('Запуск планировщика для отправки рекомендаций пользователям');
  try {
    // const users = await User.find();
    // for (const user of users) {
    //   if (!user.stopSession) {
    //     const chatExists = await checkChatExistence(user.chatId);
    //     if (chatExists) {
    //       await bot.sendMessage(Number(user.chatId), 'Я научился разговаривать с вами! Попробуйте спросить меня что-нибудь.');
    //       console.log('Notification sent to:', user.userName);

    //     }

    //   }
    // }
  } catch (error) {
    console.error('Ошибка при отправке плановых рекомендаций:', error);
  }
};

import bot from './bot';
import User from './user/models/User';
import { checkChatExistence } from './util';

const blackList = [357253401, 4274538, 194877242, 57228964];
const lastProcessedChatId = 461428743; 

export const notifyAll = async () => {
  console.log('Запуск планировщика для отправки рекомендаций пользователям');
  let startProcessing = false;

  try {
    const users = await User.find();

    for (const user of users) {
      const userChatId = Number(user.chatId);
      
      try{
        if (!startProcessing) {
          if (userChatId === lastProcessedChatId) {
            startProcessing = true;
          }
          continue;
        }
  
        if (!user.stopSession) {
          const chatExists = await checkChatExistence(userChatId);
  
          if (chatExists) {
            if (blackList.includes(userChatId)) {
              console.log('User is in blacklist:', user.userName);
              continue;
            } else {
              await bot.sendMessage(userChatId, '🎁 Хотите 500 тенге? Пригласите 5 друзей с помощью /ref! Делитесь ссылкой и получайте крутые бонусы. Не упустите шанс на больше веселья! 🎉💃');
              console.log('Notification sent to:', user.userName);
  
              console.log('Last processed user:', user.userName, 'chatId:', userChatId);
            }
          }
        }
      }catch{
        console.log('Ошибка при отправке плановых рекомендаций:', user.userName);
      }
    }
  } catch (error) {
    console.error('Ошибка при отправке плановых рекомендаций:', error);
  }
};

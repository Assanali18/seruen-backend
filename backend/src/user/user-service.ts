import { getRecommendations } from '../recomendation';
import { CreateUserDto } from './dtos/CreateUser.dto';
import  User, { IUser }  from './models/User';

// this user service instance shows how to create a user, get a user by id, and get all users with in-memory data
class UserService {
  async createUser(userDto: CreateUserDto) {
    const { userName, email, phone, spendingLimit, schedule, hobbies } = userDto;
    const newUser = new User({
      userName,
      email,
      phone,
      spendingLimit,
      hobbies,
      schedule
    });
    console.log('userName from form', userName);
    // Не добавлять юзера, если он уже есть в базе

    await newUser.save();
    console.log('newUser', newUser);
    
    return newUser;

    const welcomeMessage = `Привет, ${userName}! Добро пожаловать в Seruen. Мы будем присылать вам персонализированные рекомендации по мероприятиям.`;

    
    // bot.sendMessage(phone, welcomeMessage);
    // const userPreferences = { profession: "unknown", salary: spendingLimit, schedule, hobbies, userName };
    // const recommendations = await getRecommendations(userPreferences);





  }
}

export default UserService;

import { CreateUserDto } from './dtos/CreateUser.dto';
import User, { IUser } from './models/User';

class UserService {
  async createUser(userDto: CreateUserDto) {
    const { userName, email, phone, spendingLimit, schedule, hobbies } = userDto;
    const newUser = new User({
      userName,
      email,
      phone,
      spendingLimit,
      hobbies,
      schedule,
    });

    // Проверка на существование пользователя в базе данных
    const existingUser = await User.findOne({ userName });
    if (existingUser) {
      throw new Error('User already exists');
    }

    await newUser.save();
    return newUser;
  }

  async getUserRecommendations(username: string) {
    const user = await User.findOne({ userName: username }) || await User.findOne({ userName: { $regex: new RegExp('^' + username + '$', 'i') } });
    if (user) {
      return user.recommendations;
    }
    return null;
  }
}

export default UserService;

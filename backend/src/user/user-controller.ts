import { Request, Response } from 'express';
import UserService from './user-service';
import { CreateUserDto } from './dtos/CreateUser.dto';

class UserController {
  private userService: UserService;

  constructor(userService: UserService) {
    this.userService = userService;
  }

  createUser = async (req: Request, res: Response) => {
    try {
      const user: CreateUserDto = req.body;
      const newUser = await this.userService.createUser(user);
      res.status(201).json(newUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getUserRecommendations = async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const recommendations = await this.userService.getUserRecommendations(username);
      if (recommendations) {
        res.status(200).json(recommendations);
      } else {
        res.status(404).json({ error: 'User not found or no recommendations available.' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

export default UserController;

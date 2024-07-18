import { CreateUserDto } from './dtos/CreateUser.dto';
import UserService from './user-service';
import { Request, Response } from 'express';

// a user controller is a class that handles the user routes (incoming frontend requests)
class UserController {
  private userService: UserService;

  constructor(userService: UserService) {
    this.userService = userService;
  }

  createUser = (req: Request, res: Response) => {
    try {
      const user: CreateUserDto = req.body;
      const newUser = this.userService.createUser(user);
      res.status(201).json(newUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };


}

export default UserController;

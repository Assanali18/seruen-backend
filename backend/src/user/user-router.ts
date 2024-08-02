import { Router } from 'express';
import UserController from './user-controller';
import UserService from './user-service';

const userRouter = Router();

const userService = new UserService();
const userController = new UserController(userService);

userRouter.post('/users/', userController.createUser);
userRouter.get('/users/:username/recommendations', userController.getUserRecommendations);

export default userRouter;

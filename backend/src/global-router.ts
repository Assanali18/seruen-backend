import { Router } from 'express';
import userRouter from './user/user-router';
import eventRouter from './event/event-router';
// other routers can be imported here

const globalRouter = Router();

// Use the userRouter for user-related routes
globalRouter.use(userRouter);
globalRouter.use(eventRouter);

// other routers can be added here

export default globalRouter;

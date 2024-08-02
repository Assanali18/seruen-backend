import { Router } from 'express';
import EventController from './event-controller';



const eventRouter = Router();

const eventController = new EventController();


eventRouter.post('/events', eventController.createEvents);
eventRouter.get('/events/', eventController.getEvents);



export default eventRouter;

import { Request, Response } from 'express';
import EventModel from './models/Event';
import { addEventsToPinecone, deleteEventsFromPinecone } from '../langchain';
import { CreateEventDto } from "./dtos/CreateEvent.dto";
import User from '../user/models/User';
import { generateRecommendationsForUser } from '../util';

class EventController {
    createEvents = async (req: Request, res: Response) => {
        try {
            const events: CreateEventDto[] = req.body;
            const source = req.query.source as string;

            if (!source) {
                res.status(400).send('Source is required');
                return;
            }

            await EventModel.deleteMany({ source });
            console.log(`Events from source ${source} deleted`);

            await deleteEventsFromPinecone(source);

            const uniqueEvents = events.map(event => ({ ...event, source }));

            if (uniqueEvents.length > 0) {
                await EventModel.insertMany(uniqueEvents);
                console.log('Events received and saved', uniqueEvents.length);

                await addEventsToPinecone();
                res.status(200).send('Unique events received and saved');

                // Начинаем генерацию рекомендаций для всех пользователей
                const users = await User.find();
                for (const user of users) {
                    await generateRecommendationsForUser(user);
                }
                console.log('Recommendations generated for all users');
            } else {
                res.status(200).send('No unique events to save');
            }
        } catch (error) {
            console.error('Error saving events:', error);
            res.status(500).send('Error saving events');
        }
    }

    getEvents = async (req: Request, res: Response) => {
        try {
            const events = await EventModel.find();
            res.status(200).send(events);
        } catch (error) {
            console.error('Error getting events:', error);
            res.status(500).send('Error getting events');
        }
    }
}

export default EventController;

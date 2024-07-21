import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import EventModel, { IEvent } from './event/models/Event';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME!;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pinecone.Index(PINECONE_INDEX_NAME);

const getEmbeddings = async (contents: string[]): Promise<number[][]> => {
  const embeddings: number[][] = [];
  for (const content of contents) {
    console.log('Generating embeddings for:', content);
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: content,
    });
    console.log('Response from OpenAI:', response.data);
    
    if (response.data && response.data[0] && response.data[0].embedding) {
      embeddings.push(response.data[0].embedding);
    } else {
      throw new Error('Invalid response from OpenAI API');
    }
  }
  return embeddings;
};

export const addEventsToPinecone = async () => {
  try {
    const events: IEvent[] = await EventModel.find();
    const eventContents = events
      .filter(event => event.venue)
      .map(event => {
        return `${event.description ?? ''} Дата: ${event.date ?? ''} Время: ${event.time ?? ''} Цена: ${event.price ?? ''}`;
      });
    console.log('Events fetched successfully.');
    
    const embeddings = await getEmbeddings(eventContents);
    console.log('Embeddings generated successfully.');
    
    const upserts = embeddings.map((embedding, idx) => ({
      id: (events[idx]._id as string).toString(),
      values: embedding,
      metadata: {
        title: events[idx].title,
        description: events[idx].description ?? '',
        date: events[idx].date ?? '',
        time: events[idx].time ?? '',
        venue: events[idx].venue ?? '',
        price: events[idx].price ?? '',
        ticketLink: events[idx].ticketLink ?? '',
      },
    }));

    await index.upsert(upserts);
    console.log('Events successfully added to Pinecone.');
  } catch (error) {
    console.error('Error adding events to Pinecone:', error);
  }
};

export const deleteEventsFromPinecone = async () => {
  try {
    await index.deleteAll();
    console.log('Events successfully deleted from Pinecone.');
  } catch (error) {
    console.error('Error deleting events from Pinecone:', error);
  }
};

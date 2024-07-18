import { Event } from './types';
import EventModel from './event/models/Event';
import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const CHUNK_SIZE = 10;

export const getEventChunks = (events: Event[], chunkSize: number): Event[][] => {
  const chunks: Event[][] = [];
  for (let i = 0; i < events.length; i += chunkSize) {
    chunks.push(events.slice(i, i + chunkSize));
  }
  return chunks;
};

export const getRecommendations = async (chunk: Event[], userPreferences: { spendingLimit?: number; hobbies?: string[]; userName?: string; }): Promise<{ venue: string; ticketLink: string; message: string; }[]> => {

  chunk.forEach(event => {
    console.log("Title : ", event.title, "Price : ", event.price, "Date : ", event.date );
  });

  const userPrompt = `
    I have provided between 0 and 10 events.
    Please pay special attention to the user's hobbies and budget.
    Firstly, the recommended events should be based on user's hobbies.
    Secondly, the price of the event should not exceed the user's budget.
    Select as many events as you see fit based on the given criteria.
    User's budget: ${userPreferences.spendingLimit}
    User's hobbies: ${JSON.stringify(userPreferences.hobbies)}
    Events: ${JSON.stringify(chunk)}

    Please recommend the most relevant events, sorted by relevance, in a list of creative, interesting, and engaging messages with all necessary details, including the date, time, venue, and appropriate emojis related to the event.
    Use the user's name **${userPreferences.userName}** in the message explaining why they should attend each event. Respond as a professional SMM specialist.
    Be sure that the price of the event was not more expensive than the user's budget by 3000 tenge.
    Avoid repeating events in the recommendations.
    Do not invent new events, only use the events provided.
    Discard any events that do not fit the user's preferences based on the provided criteria.
    Return the response as a valid array of objects, each with keys "venue", "ticketLink", and "message" containing the formatted event details.
    If you are unable to find any events that meet the user's criteria, return an empty array.

    Example:
    [
      {
        "venue": "Almaty Arena, мкр. Нуркент, 7",
        "ticketLink": "https://sxodim.com/almaty/kontserty/solnyy-koncert-jony/tickets",
        "message": "🔥 Готовы погрузиться в мир эмоций и драйва? 🔥\\n\\nСольный концерт JONY уже совсем скоро! 🎉\\n\\n🗓️ 22.09.2024\\n💰 20000 тг\\n**⏰ 20:00\\n📍 Almaty Arena, мкр. Нуркент, 7\\n\\n🎤 JONY исполнит свои самые популярные хиты, заставит вас петь и танцевать всю ночь напролет!\\n\\n🎫 Билеты уже в продаже: https://sxodim.com/almaty/kontserty/solnyy-koncert-jony/tickets \\n\\nНе пропустите это незабываемое событие! 💥"
      }
    ]
  `;

  console.log('Sending message for chunk...');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: userPrompt },
      ],
    });

    let responseText = response.choices[0].message.content || '';
    console.log('Response:', responseText);

    // Clean and format the response text to ensure proper JSON formatting
    responseText = responseText.replace(/```json|```/g, '').trim();
    responseText = responseText.replace(/[\u0000-\u001F\u007F-\u009F]/g, (char) => {
      if (char === '\n' || char === '\t') {
        return char;
      }
      return ' ';
    });
    responseText = responseText.replace(/\\n/g, '\\n').replace(/\\r/g, '\\r').replace(/\\t/g, '\\t');

    console.log('Clean Response:', responseText);

    const parsedResponse = JSON.parse(responseText);

    if (Array.isArray(parsedResponse)) {
      return parsedResponse;
    } else {
      console.warn('Unexpected response format:', parsedResponse);
      return [];
    }

  } catch (error) {
    console.error('Error during communication or parsing:', error);
    return [];
  }
}
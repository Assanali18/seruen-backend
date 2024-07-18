import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import { Event } from './types';

const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  throw new Error('API_KEY is not set');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


const suggestFollowUpActivities = async (mainEvent: Event) => {
  let endTime: Date;

  try {
    const eventDateParts = mainEvent.date?.split('.')||'';
    const eventTimeParts = mainEvent.time?.split(':')||'';
    const eventDate = new Date(parseInt(eventDateParts[2]), parseInt(eventDateParts[1]) - 1, parseInt(eventDateParts[0]), parseInt(eventTimeParts[0]), parseInt(eventTimeParts[1]));
    endTime = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);

    if (isNaN(endTime.getTime())) {
      throw new Error("Invalid date");
    }
  } catch (error) {
    console.error("Error parsing event date:", error);
    endTime = new Date();
  }

  const prompt = `
    Given that the user has attended the event titled "${mainEvent.title}" that ends at ${endTime.toISOString()},
    suggest follow-up 1 activity near "${mainEvent.venue}" that align with typical user preferences and schedules. And start the activity at least 1 hour after the event ends.
    Please return the data in the following JSON format:
    [
      {
        "title": "Activity Title",
        "date": "Start Date and Time in ISO format",
        "description": "Brief description of the activity",
        "ticketLink": "URL to purchase tickets or more information"
      }
    ]
  `;

  try {
    const chat = await model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: prompt }],
        }
      ],
    });

    const result = await chat.sendMessage("Suggest follow-up activities.");
    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    console.log("Response Text for Debugging:", responseText);
    return JSON.parse(responseText);
  } catch (error:any) {
    console.error('Error suggesting follow-up activities:', error);
    console.error('Failed JSON:', error.message);
    return [];
  }
};

export default suggestFollowUpActivities;

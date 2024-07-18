import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import { Event } from './types';

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY is not set');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { "responseMimeType": "application/json" }});

const getCoordinatesFromAddress = async (address: string | undefined) => {
  const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
    params: {
      address,
      key: googleMapsApiKey
    }
  });

  if (response.data.status !== 'OK') {
    throw new Error('Geocoding API error: ' + response.data.status);
  }

  const location = response.data.results[0].geometry.location;
  return location;
};

const suggestFollowUpActivities = async (mainEvent: Event) => {
  let endTime: Date;

  try {
    const [eventDatePart, eventTimePart] = mainEvent.date?.split(' ') || ['', ''];
    const [day, month, year] = eventDatePart.split('.').map(Number);
    const [hour, minute, second] = eventTimePart.split(':').map(Number);
    const eventDate = new Date(year, month - 1, day, hour, minute, second);
    endTime = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);

    if (isNaN(endTime.getTime())) {
      throw new Error("Invalid date");
    }
  } catch (error) {
    console.error("Error parsing event date:", error);
    endTime = new Date();
  }

  const location = await getCoordinatesFromAddress(mainEvent.venue);
  console.log('Location:', location);

  const locationString = `${location.lat},${location.lng}`;

  const placesResponse = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
    params: {
      location: locationString,
      radius: 1000,
      type: 'restaurant',
      key: googleMapsApiKey
    }
  });

  const places = placesResponse.data.results.map(place => ({
    name: place.name,
    location: place.geometry.location,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
  }));

  const prompt = `
    Based on the event titled "${mainEvent.title}" ending at ${endTime.toISOString()}, suggest one follow-up activity near "${mainEvent.venue}" that aligns with user preferences.
    Here are some nearby places: ${JSON.stringify(places)}
    Please return the suggestion in the following JSON format:
    
    {
      "title": "Place Name",
      "location": "Coordinates",
      "userRatingsTotal": "Total Ratings"
    }
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

    const result = await chat.sendMessage("Suggest a follow-up activity.");
    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    console.log("Response Text:", responseText);

    return JSON.parse(responseText);
  } catch (error: any) {
    console.error('Error suggesting follow-up activities:', error);


    if (error.message.includes('Candidate was blocked due to SAFETY')) {
      console.log('Handling safety block error, adjusting the prompt or falling back to secondary content.');

    }

    return []; 
  }
};




export default suggestFollowUpActivities;

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Seat } from './types';
import getSuitableSeats from './parser copy';

const downloadHallImage = async () => {
    const imageUrl = "https://sxodim.com/uploads/halls/316/z3pGyKunrAZYrKm0z169cXgkV4ZYM4XjutgnGK3i.svg";
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const filePath = path.resolve(__dirname, 'hallImage.svg');
    fs.writeFileSync(filePath, response.data);
    console.log('Image downloaded and saved to', filePath);
    return filePath;
};

const downloadImageAndPrepareData = async () => {
  const filteredSeats = getSuitableSeats();
  console.log('Filtered seats:', filteredSeats);
  
  // const seatDescriptions = filteredSeats.map(seat => `Seat ID: ${seat.id}, Price: ${seat.seatPrice.rate.price}, Location: (${seat.x}, ${seat.y})`).join('; ');

  // const imagePath = await downloadHallImage();
  // const imageData = fs.readFileSync(imagePath);
  
  // return { image: imageData, seatDescriptions };
};
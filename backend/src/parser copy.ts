import axios from "axios"
import { Response } from 'express';
import { Seat } from "./types";

const parseHallFromPage = async()=>{
  let seats: Seat[] = [];
  try{
    
  const response = await axios.get("https://sxodim.com/api/tickets/8591/hall?date=22.09.2024&timeslot_id=22488", {
    headers: {
      "accept": "application/json",
      "accept-language": "ru-KZ,ru;q=0.9,en-KZ;q=0.8,en;q=0.7,ru-RU;q=0.6,en-US;q=0.5",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\", \"Google Chrome\";v=\"126\"",
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": "\"Android\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": "x27RkvnbRSqr9xTF477Pqir9H1Q0V34vL9rTMhcy",
      "x-requested-with": "XMLHttpRequest",
      "x-xsrf-token": "eyJpdiI6IlhJbVBlVnJId3BDdTVhQnIrdVN1RXc9PSIsInZhbHVlIjoiUE9kWUJsYlNxRFpySHpVdFIwaVREZVY4VE5ZRWlzTzRnVVB4VVJIMnJwYXZiejZXdEJkUGxHXC9kcytZdnRFdHhqWlpRNUQzZ0lJXC9JRk8xMjNEbjBSZEdZelwvU2MrdjQ1TEYzNldKXC9NVlZsRVJ5SXRQeEtzTHBCdmxGOEsxbEhWIiwibWFjIjoiNTllM2IwZmVkMTAzNTQyYjY2NjlmN2I2MmI5ZjQzNDEyMjM3ZTJhZTIxNzI5OWQ3MzM1MTYxMDQyNmFkOThlNCJ9",
      "cookie": "_ym_uid=1719831817745763307; _ym_d=1719831817; _ym_isad=2; _ga=GA1.1.2111347216.1719831818; _fbp=fb.1.1719831818822.81203159265622349; remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=eyJpdiI6Ik0xWCtjRGxZWHJCZnFLcWNuczROT3c9PSIsInZhbHVlIjoiWHNYT0NZdzY4amJiZmhBWXJORDhlRlVmRm84NHlnM0liV09JMTVXTTdnQ1hwVER2NXBlajNOR3IycjlWNElvMlg3cnZSVW00anNCalAxY0t0WGR1NUpveUZVZWRTU0lrbGdnSVhZNkN1ZTdnZldkZW8wY2JhTzdIWXFwY3QxM1lxcXRyNElTRUJqcHBEU0s1ek9oQkJnREd4Tm1RakNyTlhVeXhUVmZBS3Q3YkR1TTdkWkF2bER6aHFZSzJoT0ViVlwvTUt2UGhQeExBU0JOVjNlRzZvTTYwSXNZcnZrWXFaN0V3ekJoaHplczA9IiwibWFjIjoiMjQ1OGM4OTA3ZjdlNTFiMmMyODcwM2U1YzdhMDYzOGNkYWJhYmI1MWZmYzg0Y2NmMzBiNzRjNDY0MzQ3YjYzOSJ9; _gcl_au=1.1.487561052.1719831818.807728552.1719832145.1719832145; fpestid=IrShxYtNlIB1t4FvOBvaxq3Yus3DQRyWS6n-5aHQ5hZmqYzXVzRUOFlqG7Q3hFQXlFYaJA; _cc_id=55e3347ec2cae858b361a876a3486afa; panoramaId_expiry=1719918590332; _ym_visorc=w; laravel_token=eyJpdiI6IlBOTDNIMFlvRitQYUdIVEFkeHk5Y0E9PSIsInZhbHVlIjoiRmNNMVJTSHoxMVJJbCtxb3V2ZlJvN0NnbHNYVzN2M29pQVJzNGgyZU95c0o1OGIxcVlUWGtLbkF5ZWtXaVhQYUFiXC9xMXRvSTA2Njk5OTdjVExST0xHOUVwTUlUbGU0OE1RSkZXVEdVMGJJN3lFa3R6V2kzdFFFckdCNmNlWkNZRTZJdWJUMHpCdzQ3V1hyWnVlQ3VtMmNkY2ZLQzV0TkJ3MXJzMkhFNXZEcUl0VURPWHhmdk1Gc1NDdzJaY2N3WkVhdUN5QVJFR1ZOa3ZXMGFjQVBmek9IMWxOTXlVYzBudjdvVmJ0dkpUa1NzZ3ZCRDVuRUN3N2JiR2JnRGpMUGlkdDdPcURnbUtHNjVzcFlZXC9taUR3SnN6Rm0waHVMdmNHRjdudkczSXl2ZWdzNUJtOUhVRnhWXC9CSWU5R2w3ZGQiLCJtYWMiOiJmMWQ5ZDkxYjdjZjllODYyZmEzM2JlMmI1MTUwMThjNjdkZGIwZmRkODQ4MTFiODMzYzJkODU1ZjVjZmE0MmUxIn0%3D; XSRF-TOKEN=eyJpdiI6IlhJbVBlVnJId3BDdTVhQnIrdVN1RXc9PSIsInZhbHVlIjoiUE9kWUJsYlNxRFpySHpVdFIwaVREZVY4VE5ZRWlzTzRnVVB4VVJIMnJwYXZiejZXdEJkUGxHXC9kcytZdnRFdHhqWlpRNUQzZ0lJXC9JRk8xMjNEbjBSZEdZelwvU2MrdjQ1TEYzNldKXC9NVlZsRVJ5SXRQeEtzTHBCdmxGOEsxbEhWIiwibWFjIjoiNTllM2IwZmVkMTAzNTQyYjY2NjlmN2I2MmI5ZjQzNDEyMjM3ZTJhZTIxNzI5OWQ3MzM1MTYxMDQyNmFkOThlNCJ9; sxodim_session=eyJpdiI6IkxrK1d5bUJ2XC9WUXBWQlFVdUVUT05BPT0iLCJ2YWx1ZSI6InhBVHpVWHBiOG5aYytwZm5rcTZLUFY0dW9PYmxqb3ZqVk9KWnY5cWlaQ05Jc0dsam4xWVwvWm00RUNzcHQ3elpMZld1QVdtQzhtRlo1cDJWa2xEU2Q0UEZGV3NsUktCQ2M2TlR4ZUxiVDJPZEYwcDdrUXBncUtYemhNbURjMkd0QyIsIm1hYyI6IjQzZGI1ZGEwM2I1MjdmMGY2MTdmNTRiOTAxMjY2NTFjODMxMDAzNWUwYTQ4OGY3MTlmMjc0N2VhNTY0MmM1N2MifQ%3D%3D; _ga_GKJ7QMWPZM=GS1.1.1719837966.2.1.1719837988.0.0.0",
      "Referer": "https://sxodim.com/almaty/kontserty/solnyy-koncert-jony/tickets",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  });
  seats = response.data.data.seats;
  }catch(error){
    console.error('Error fetching data: ', error);
  };


  return seats;
}
// Cost, seats, number of seats
const filterFreeSeats = (seats: Seat[], numberRequired: number): Seat[][] => {
  const freeSeats = seats.filter(seat => seat.available === 1 && 
    seat.seatPrice && 
    seat.seatPrice.rate.price >= 10000 && 
    seat.seatPrice.rate.price <= 20000);
  const groupedSeats = {};

  for (const seat of freeSeats) {
    const key = `${seat.sector_id}-${seat.row}`;
    if (!groupedSeats[key]) {
      groupedSeats[key] = [];
    }
    groupedSeats[key].push(seat);
  }

  const suitableSeats: Seat[][] = [];

  for (const rowKey in groupedSeats) {
    const seatsInRow = groupedSeats[rowKey].sort((a, b) => a.column - b.column);
    let consecutiveSeats: Seat[] = [];

    for (const seat of seatsInRow) {
      if (consecutiveSeats.length === 0 || seat.column === consecutiveSeats[consecutiveSeats.length - 1].column + 1) {
        consecutiveSeats.push(seat);
        if (consecutiveSeats.length === numberRequired) {
          suitableSeats.push([...consecutiveSeats]);
          consecutiveSeats = [];
        }
      } else {
        consecutiveSeats = [seat];
      }
    }
  }

  return suitableSeats;
};


const getSuitableSeats = async () => {
  const seats = await parseHallFromPage();

  const suitableSeats = filterFreeSeats(seats, 2);
  return suitableSeats;
};

export default getSuitableSeats;




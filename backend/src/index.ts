import express from 'express';
import { logger } from './logger';
import parseHallFromPage from './parser copy';
import run from './parser copy';
import './telegramBot'; 
import { parseEvents } from './parser';
import puppeteer, { Page } from 'puppeteer';
import buyHallTicket from './hall-tickets';
import globalRouter from './global-router';
import connectDB from './db';
import cors from 'cors';


const app = express();
const PORT = process.env.PORT || 3001;

connectDB();

app.use(logger);
app.use(express.json({ limit: '50mb' })); 

const corsOptions = {
  origin: '*', 
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204
};


app.use(cors(corsOptions));
app.use('/api', globalRouter);


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});




// // buyHallTicket();
// parseEvents(); 
// // buyTickets();



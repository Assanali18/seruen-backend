import express from 'express';
import { logger } from './logger';
import './bot'; 
import { parseEvents } from './parser';
import puppeteer, { Page } from 'puppeteer';
import globalRouter from './global-router';
import connectDB from './db';
import cors from 'cors';
import { deleteEventsFromPinecone } from './langchain';
import axios from 'axios';
import { testFunction } from './cron';
import { notifyAll } from './notify';


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



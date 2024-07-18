import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  title: string;
  date?: string | null;
  description?: string;
  time?: string;
  venue?: string;
  price?: string;
  ticketLink?: string;
  source?: string;
}

export const EventSchema:Schema = new Schema({     
  title: { type: String, required: true },
  date: { type: String },
  description: { type: String },
  time: { type: String },
  venue: { type: String },
  price: { type: String },
  ticketLink: { type: String },
  source: String,
});

export default mongoose.model<IEvent>('Event', EventSchema);

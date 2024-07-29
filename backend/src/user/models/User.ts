import mongoose, { Schema, Document } from 'mongoose';

const recommendationSchema = new mongoose.Schema({
  venue: String,
  ticketLink: String,
  message: String,
});

const eventSchema = new Schema({
  title: String,
  date: String, // Изменено на строку
  message: String,
  ticketLink: String,
});

export interface IUser extends Document {
  userName: string;
  email?: string;
  phone?: string;
  spendingLimit?: number;
  hobbies?: string[];
  schedule?: string[];
  chatId?: string;
  recommendations?: any[];
  lastRecommendationIndex?: number;
  stopSession: boolean;
  generatedPosts?: any[];
  lastGeneratedPostIndex?: number;
  priority?: string;
  likedEvents?: { title: string; date: string; message: string; ticketLink: string|''; }[]; 
  dislikedEvents?: { title: string; date: string; message: string; ticketLink: string|''; }[]; 
  points?: number; // Новое поле для хранения очков пользователя
}

const UserSchema: Schema = new Schema({
  userName: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  spendingLimit: { type: Number },
  hobbies: { type: [String] },
  schedule: { type: [String] },
  chatId: { type: String },
  recommendations: [recommendationSchema],
  lastRecommendationIndex: { type: Number, default: 0 },
  stopSession: { type: Boolean, default: false },
  generatedPosts: [Schema.Types.Mixed],
  lastGeneratedPostIndex: { type: Number, default: 0 },
  priority: { type: String, default: 'preference' },
  likedEvents: [eventSchema],
  dislikedEvents: [eventSchema],
  points: { type: Number, default: 0 }, // Инициализируем новое поле очков
});

export default mongoose.model<IUser>('User', UserSchema);

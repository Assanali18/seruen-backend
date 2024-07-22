import mongoose, { Schema, Document } from 'mongoose';

const recommendationSchema = new mongoose.Schema({
  venue: String,
  ticketLink: String,
  message: String,
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
});

export default mongoose.model<IUser>('User', UserSchema);

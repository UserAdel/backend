import { Schema, model, type InferSchemaType } from 'mongoose';

const bookingRequestSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, trim: true },
    nationality: { type: String, required: true, trim: true },
    arrivalDate: { type: String, trim: true },
    preferredDate: { type: String, required: true, trim: true },
    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, required: true, min: 0 },
    language: { type: String, required: true, enum: ['en', 'fr'] },
    specialRequests: { type: String, trim: true },
    selectedActivity: { type: String, required: true, trim: true },
    activityName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'new', 'contacted', 'confirmed', 'cancelled'],
      default: 'new',
      index: true,
    },
    adminNotes: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type BookingRequestDocument = InferSchemaType<typeof bookingRequestSchema>;

export const BookingRequest = model<BookingRequestDocument>(
  'BookingRequest',
  bookingRequestSchema
);

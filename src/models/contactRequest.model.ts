import { Schema, model, type InferSchemaType } from 'mongoose';

const contactRequestSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['new', 'read', 'replied', 'archived'],
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

export type ContactRequestDocument = InferSchemaType<typeof contactRequestSchema>;

export const ContactRequest = model<ContactRequestDocument>(
  'ContactRequest',
  contactRequestSchema
);

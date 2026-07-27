import { Schema, model, type InferSchemaType } from 'mongoose';

const localizedStringSchema = new Schema(
  {
    en: { type: String, required: true, trim: true, maxlength: 2000 },
    fr: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const testimonialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: localizedStringSchema, required: true },
    activity: { type: localizedStringSchema, required: true },
    sortOrder: { type: Number, default: 0, min: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type TestimonialDocument = InferSchemaType<typeof testimonialSchema>;

export const Testimonial = model<TestimonialDocument>(
  'Testimonial',
  testimonialSchema
);

import { Schema, model, type InferSchemaType } from 'mongoose';

const localizedStringSchema = new Schema(
  {
    en: { type: String, required: true, trim: true },
    fr: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const activityCategorySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: localizedStringSchema, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type ActivityCategoryDocument = InferSchemaType<typeof activityCategorySchema>;

export const ActivityCategory = model<ActivityCategoryDocument>(
  'ActivityCategory',
  activityCategorySchema
);

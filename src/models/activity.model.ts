import { Schema, model, type InferSchemaType } from 'mongoose';

const localizedStringSchema = new Schema(
  {
    en: { type: String, required: true, trim: true },
    fr: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const localizedListSchema = new Schema(
  {
    en: [{ type: String, required: true, trim: true }],
    fr: [{ type: String, required: true, trim: true }],
  },
  { _id: false }
);

const pricingSchema = new Schema(
  {
    adult: Number,
    child: Number,
    private: Number,
    extraPerson: Number,
    visitor: Number,
  },
  { _id: false }
);

const pricingFieldSchema = new Schema(
  {
    id: { type: String, trim: true },
    name: { type: localizedStringSchema, required: true },
    price: { type: Number, required: true, min: 0 },
    isMain: { type: Boolean, default: false },
  },
  { _id: false }
);

const activitySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: localizedStringSchema, required: true },
    category: { type: String, required: true, index: true, trim: true },
    description: { type: localizedStringSchema, required: true },
    highlights: { type: localizedListSchema, required: true },
    pricing: { type: pricingSchema, required: true },
    pricingFields: { type: [pricingFieldSchema], default: [] },
    ageRestrictions: { type: localizedStringSchema, required: true },
    duration: { type: String, required: true, trim: true },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    times: [{ type: String, trim: true }],
    maxCapacity: Number,
    maxWeight: Number,
    included: { type: localizedListSchema, required: true },
    excluded: localizedListSchema,
    imageUrl: { type: String, required: true, trim: true },
    galleryImages: [{ type: String, trim: true }],
    featured: { type: Boolean, default: false },
    childFriendly: { type: Boolean, required: true },
    familyFriendly: { type: Boolean, required: true },
    pickupIncluded: { type: Boolean, required: true },
    availableDaily: { type: Boolean, default: true },
    freeCancellation: { type: Boolean, default: true },
    privateAvailable: { type: Boolean, required: true },
    groupAvailable: { type: Boolean, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    id: false,
    versionKey: false,
  }
);

export type ActivityDocument = InferSchemaType<typeof activitySchema>;

export const Activity = model<ActivityDocument>('Activity', activitySchema);

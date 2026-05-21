import Joi from 'joi';

export const createBookingRequestSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().min(5).max(40).required(),
  whatsapp: Joi.string().trim().min(5).max(40).required(),
  hotelName: Joi.string().trim().min(2).max(160).required(),
  roomNumber: Joi.string().trim().allow('').max(40).optional(),
  nationality: Joi.string().trim().min(2).max(80).required(),
  preferredDate: Joi.string().trim().required(),
  adults: Joi.number().integer().min(1).required(),
  children: Joi.number().integer().min(0).required(),
  language: Joi.string().valid('en', 'fr').required(),
  specialRequests: Joi.string().trim().allow('').max(1500).optional(),
  selectedActivity: Joi.string().trim().required(),
});

export const createContactRequestSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().email().required(),
  message: Joi.string().trim().min(5).max(3000).required(),
});

export const updateBookingRequestSchema = Joi.object({
  status: Joi.string().valid('new', 'contacted', 'confirmed', 'cancelled').required(),
  adminNotes: Joi.string().trim().allow('').max(1500).optional(),
});

export const updateContactRequestSchema = Joi.object({
  status: Joi.string().valid('new', 'read', 'replied', 'archived').required(),
  adminNotes: Joi.string().trim().allow('').max(1500).optional(),
});

const localizedStringSchema = Joi.object({
  en: Joi.string().trim().min(1).max(5000).required(),
  fr: Joi.string().trim().min(1).max(5000).required(),
});

const localizedListSchema = Joi.object({
  en: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
  fr: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
});

const pricingSchema = Joi.object({
  adult: Joi.number().min(0).optional(),
  child: Joi.number().min(0).optional(),
  private: Joi.number().min(0).optional(),
  extraPerson: Joi.number().min(0).optional(),
  visitor: Joi.number().min(0).optional(),
}).optional();

const pricingFieldSchema = Joi.object({
  id: Joi.string().trim().allow('').max(120).optional(),
  name: localizedStringSchema.required(),
  price: Joi.number().min(0).required(),
  isMain: Joi.boolean().optional(),
});

export const activityAdminSchema = Joi.object({
  id: Joi.string().trim().min(2).max(120).required(),
  slug: Joi.string().trim().lowercase().min(2).max(160).required(),
  name: localizedStringSchema.required(),
  category: Joi.string().trim().min(2).max(120).required(),
  description: localizedStringSchema.required(),
  highlights: localizedListSchema.required(),
  pricing: pricingSchema.default({}),
  pricingFields: Joi.array().items(pricingFieldSchema).min(1).required(),
  ageRestrictions: localizedStringSchema.required(),
  duration: Joi.string().trim().min(1).max(80).required(),
  startTime: Joi.string().trim().allow('').max(20).optional(),
  endTime: Joi.string().trim().allow('').max(20).optional(),
  times: Joi.array().items(Joi.string().trim().min(1).max(20)).optional(),
  maxCapacity: Joi.number().integer().min(0).allow(null).optional(),
  maxWeight: Joi.number().integer().min(0).allow(null).optional(),
  included: localizedListSchema.required(),
  excluded: localizedListSchema.optional(),
  imageUrl: Joi.string().trim().min(1).max(500).required(),
  galleryImages: Joi.array().items(Joi.string().trim().min(1).max(500)).optional(),
  featured: Joi.boolean().required(),
  childFriendly: Joi.boolean().required(),
  familyFriendly: Joi.boolean().required(),
  pickupIncluded: Joi.boolean().required(),
  availableDaily: Joi.boolean().default(true),
  freeCancellation: Joi.boolean().default(true),
  privateAvailable: Joi.boolean().required(),
  groupAvailable: Joi.boolean().required(),
  isActive: Joi.boolean().optional(),
});

export const activityCategoryAdminSchema = Joi.object({
  id: Joi.string().trim().lowercase().min(2).max(120).required(),
  name: localizedStringSchema.required(),
  isActive: Joi.boolean().optional(),
});

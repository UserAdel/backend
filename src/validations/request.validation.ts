import Joi from 'joi';

export const createBookingRequestSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().min(5).max(40).required(),
  whatsapp: Joi.string().trim().min(5).max(40).required(),
  nationality: Joi.string().trim().min(2).max(80).required(),
  arrivalDate: Joi.string().trim().required(),
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

export const activityReviewSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  country: Joi.string().trim().min(2).max(120).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().min(5).max(2000).required(),
});

export const activityReviewApprovalSchema = Joi.object({
  isApproved: Joi.boolean().required(),
});

export const updateBookingRequestSchema = Joi.object({
  status: Joi.string().valid('pending', 'new', 'contacted', 'confirmed', 'cancelled').required(),
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

export const testimonialAdminSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  text: localizedStringSchema.required(),
  activity: Joi.object({
    en: Joi.string().trim().min(1).max(180).required(),
    fr: Joi.string().trim().min(1).max(180).required(),
  }).required(),
  sortOrder: Joi.number().integer().min(0).required(),
  isActive: Joi.boolean().required(),
});

const localizedListSchema = Joi.object({
  en: Joi.array().items(Joi.string().trim().min(1)).default([]),
  fr: Joi.array().items(Joi.string().trim().min(1)).default([]),
});

const optionalLocalizedStringSchema = Joi.object({
  en: Joi.string().trim().allow('').max(5000).default(''),
  fr: Joi.string().trim().allow('').max(5000).default(''),
});

const optionalActivityLocalizedStringSchema = Joi.object({
  en: Joi.string().trim().allow('').max(5000).default(''),
  fr: Joi.string().trim().allow('').max(5000).default(''),
}).default({ en: '', fr: '' });

const optionalActivityLocalizedListSchema = Joi.object({
  en: Joi.array().items(Joi.string().trim().allow('')).default([]),
  fr: Joi.array().items(Joi.string().trim().allow('')).default([]),
}).default({ en: [], fr: [] });

const pricingSchema = Joi.object({
  adult: Joi.number().min(0).optional(),
  child: Joi.number().min(0).optional(),
  private: Joi.number().min(0).optional(),
  extraPerson: Joi.number().min(0).optional(),
  visitor: Joi.number().min(0).optional(),
}).optional();

const pricingFieldSchema = Joi.object({
  id: Joi.string().trim().allow('').max(120).optional(),
  name: optionalActivityLocalizedStringSchema,
  price: Joi.number().min(0).optional(),
  isMain: Joi.boolean().optional(),
});

const videoHighlightSchema = Joi.object({
  id: Joi.string().trim().allow('').max(120).optional(),
  title: Joi.string().trim().min(1).max(180).required(),
  youtubeUrl: Joi.string().trim().uri().max(500).required(),
  youtubeId: Joi.string().trim().allow('').max(80).optional(),
  thumbnail: Joi.string().trim().allow('').max(500).optional(),
});

const videoReviewSchema = Joi.object({
  id: Joi.string().trim().allow('').max(120).optional(),
  name: Joi.string().trim().min(2).max(120).required(),
  nationality: Joi.string().trim().min(2).max(120).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  quote: Joi.string().trim().min(2).max(500).required(),
  youtubeUrl: Joi.string().trim().uri().max(500).required(),
  youtubeId: Joi.string().trim().allow('').max(80).optional(),
  thumbnail: Joi.string().trim().allow('').max(500).optional(),
});

export const activityAdminSchema = Joi.object({
  id: Joi.string().trim().allow('').max(120).optional(),
  slug: Joi.string().trim().lowercase().allow('').max(160).optional(),
  name: localizedStringSchema.required(),
  category: Joi.string().trim().allow('').max(120).optional(),
  description: optionalActivityLocalizedStringSchema,
  highlights: optionalActivityLocalizedListSchema,
  pricing: pricingSchema.default({}),
  pricingFields: Joi.array().items(pricingFieldSchema).optional(),
  ageRestrictions: optionalLocalizedStringSchema.default({ en: '', fr: '' }),
  duration: Joi.string().trim().allow('').max(80).optional(),
  startTime: Joi.string().trim().allow('').max(20).optional(),
  endTime: Joi.string().trim().allow('').max(20).optional(),
  times: Joi.array().items(Joi.string().trim().min(1).max(20)).optional(),
  maxCapacity: Joi.number().integer().min(0).allow(null).optional(),
  maxWeight: Joi.number().integer().min(0).allow(null).optional(),
  included: optionalActivityLocalizedListSchema,
  excluded: optionalActivityLocalizedListSchema.optional(),
  imageUrl: Joi.string().trim().allow('').max(500).optional(),
  galleryImages: Joi.array().items(Joi.string().trim().min(1).max(500)).optional(),
  featured: Joi.boolean().optional(),
  childFriendly: Joi.boolean().optional(),
  familyFriendly: Joi.boolean().optional(),
  pickupIncluded: Joi.boolean().optional(),
  availableDaily: Joi.boolean().default(true),
  freeCancellation: Joi.boolean().default(true),
  privateAvailable: Joi.boolean().optional(),
  groupAvailable: Joi.boolean().optional(),
  videoHighlights: Joi.array().items(videoHighlightSchema).optional(),
  videoReviews: Joi.array().items(videoReviewSchema).optional(),
  seoKeywords: Joi.array().items(Joi.string().trim().max(120)).optional(),
  isActive: Joi.boolean().optional(),
});

export const activityCategoryAdminSchema = Joi.object({
  id: Joi.string().trim().lowercase().min(2).max(120).required(),
  name: localizedStringSchema.required(),
  image: Joi.string().trim().allow('').optional(),
  isActive: Joi.boolean().optional(),
});

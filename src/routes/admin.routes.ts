import { Router } from 'express';
import {
  createActivityCategory,
  createActivity,
  deleteActivityCategory,
  deleteActivity,
  deleteActivityReview,
  deleteContactRequest,
  deleteTestimonial,
  getAdminActivity,
  getAdminDashboard,
  updateActivityCategory,
  updateActivity,
  updateActivityReview,
  updateBookingRequest,
  updateContactRequest,
  getSystemSettings,
  createTestimonial,
  updateTestimonial,
  updateSystemSettings,
} from '../controllers/admin.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  activityAdminSchema,
  activityCategoryAdminSchema,
  activityReviewSchema,
  updateBookingRequestSchema,
  updateContactRequestSchema,
  testimonialAdminSchema,
} from '../validations/request.validation.js';
import multerMiddleware from '../middlewares/multer.middleware.js';
import { requireAdminAuth } from '../middlewares/adminAuth.middleware.js';
import { ensureS3UploadMetadata, getS3UploadUrl } from '../services/s3Storage.service.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const activityUploadFolders = ['activities'];
const activityImageUpload = multerMiddleware({
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxFileSize: 5 * 1024 * 1024,
});

function getUploadedFilesByField(req: Request) {
  const uploadedFiles = req.files as
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  return Array.isArray(uploadedFiles)
    ? uploadedFiles.reduce<Record<string, Express.Multer.File[]>>((filesByField, file) => {
        filesByField[file.fieldname] = [...(filesByField[file.fieldname] ?? []), file];
        return filesByField;
      }, {})
    : uploadedFiles ?? {};
}

function prepareS3UploadMetadata(files: Record<string, Express.Multer.File[]>) {
  Object.values(files)
    .flat()
    .forEach((file) => ensureS3UploadMetadata(file, activityUploadFolders));
}

function parseActivityPayload(req: Request, res: Response, next: NextFunction) {
  if (typeof req.body.payload === 'string') {
    try {
      req.body = JSON.parse(req.body.payload);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity payload',
      });
    }
  }

  const files = getUploadedFilesByField(req);

  try {
    prepareS3UploadMetadata(files);

    if (files.image?.[0] && !req.body.imageUrl) {
      req.body.imageUrl = getS3UploadUrl(files.image[0], activityUploadFolders);
    }
  } catch (error) {
    next(error);
    return;
  }

  if (!Array.isArray(req.body.galleryImages)) {
    req.body.galleryImages = [];
  }

  if (!Array.isArray(req.body.videoHighlights)) {
    req.body.videoHighlights = [];
  }

  if (!Array.isArray(req.body.videoReviews)) {
    req.body.videoReviews = [];
  }

  next();
}

function parseCategoryPayload(req: Request, res: Response, next: NextFunction) {
  if (typeof req.body.payload === 'string') {
    try {
      req.body = JSON.parse(req.body.payload);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid category payload',
      });
    }
  }
  next();
}

router.use('/admin', requireAdminAuth);

router.get('/admin/dashboard', getAdminDashboard);
router.post(
  '/admin/testimonials',
  validateRequest(testimonialAdminSchema),
  createTestimonial
);
router.patch(
  '/admin/testimonials/:id',
  validateRequest(testimonialAdminSchema),
  updateTestimonial
);
router.delete('/admin/testimonials/:id', deleteTestimonial);
router.post(
  '/admin/activity-categories',
  activityImageUpload.any(),
  parseCategoryPayload,
  validateRequest(activityCategoryAdminSchema),
  createActivityCategory
);
router.patch(
  '/admin/activity-categories/:id',
  activityImageUpload.any(),
  parseCategoryPayload,
  validateRequest(activityCategoryAdminSchema),
  updateActivityCategory
);
router.delete('/admin/activity-categories/:id', deleteActivityCategory);
router.post(
  '/admin/activities',
  activityImageUpload.any(),
  parseActivityPayload,
  validateRequest(activityAdminSchema),
  createActivity
);
router.get('/admin/activities/:id', getAdminActivity);
router.patch(
  '/admin/activities/:id',
  activityImageUpload.any(),
  parseActivityPayload,
  validateRequest(activityAdminSchema),
  updateActivity
);
router.delete('/admin/activities/:id', deleteActivity);
router.patch('/admin/activities/:id/reviews/:reviewId', validateRequest(activityReviewSchema), updateActivityReview);
router.delete('/admin/activities/:id/reviews/:reviewId', deleteActivityReview);
router.patch('/admin/bookings/:id', validateRequest(updateBookingRequestSchema), updateBookingRequest);
router.patch('/admin/contacts/:id', validateRequest(updateContactRequestSchema), updateContactRequest);
router.delete('/admin/contacts/:id', deleteContactRequest);
router.get('/admin/settings', getSystemSettings);
router.patch('/admin/settings', updateSystemSettings);

export default router;

import { Router } from 'express';
import {
  createActivityCategory,
  createActivity,
  deleteActivityCategory,
  deleteActivity,
  deleteActivityReview,
  deleteContactRequest,
  getAdminActivity,
  getAdminDashboard,
  updateActivityCategory,
  updateActivity,
  updateActivityReview,
  updateBookingRequest,
  updateContactRequest,
} from '../controllers/admin.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  activityAdminSchema,
  activityCategoryAdminSchema,
  activityReviewSchema,
  updateBookingRequestSchema,
  updateContactRequestSchema,
} from '../validations/request.validation.js';
import multerMiddleware from '../middlewares/multer.middleware.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const activityImageUpload = multerMiddleware({
  getPath: () => ['activities'],
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxFileSize: 5 * 1024 * 1024,
});

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

  const uploadedFiles = req.files as
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const files = Array.isArray(uploadedFiles)
    ? uploadedFiles.reduce<Record<string, Express.Multer.File[]>>((filesByField, file) => {
        filesByField[file.fieldname] = [...(filesByField[file.fieldname] ?? []), file];
        return filesByField;
      }, {})
    : uploadedFiles;

  if (files?.image?.[0] && !req.body.imageUrl) {
    req.body.imageUrl = `/uploads/activities/${files.image[0].filename}`;
  }

  if (!Array.isArray(req.body.galleryImages)) {
    req.body.galleryImages = [];
  }

  if (!Array.isArray(req.body.videoHighlights)) {
    req.body.videoHighlights = [];
  }

  next();
}

router.get('/admin/dashboard', getAdminDashboard);
router.post('/admin/activity-categories', validateRequest(activityCategoryAdminSchema), createActivityCategory);
router.patch('/admin/activity-categories/:id', validateRequest(activityCategoryAdminSchema), updateActivityCategory);
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

export default router;

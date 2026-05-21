import { Router } from 'express';
import {
  createActivityCategory,
  createActivity,
  deleteActivityCategory,
  deleteActivity,
  getAdminActivity,
  getAdminDashboard,
  updateActivityCategory,
  updateActivity,
  updateBookingRequest,
  updateContactRequest,
} from '../controllers/admin.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  activityAdminSchema,
  activityCategoryAdminSchema,
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

  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  if (files?.image?.[0] && !req.body.imageUrl) {
    req.body.imageUrl = `/uploads/activities/${files.image[0].filename}`;
  }

  if (!Array.isArray(req.body.galleryImages)) {
    req.body.galleryImages = [];
  }

  next();
}

router.get('/admin/dashboard', getAdminDashboard);
router.post('/admin/activity-categories', validateRequest(activityCategoryAdminSchema), createActivityCategory);
router.patch('/admin/activity-categories/:id', validateRequest(activityCategoryAdminSchema), updateActivityCategory);
router.delete('/admin/activity-categories/:id', deleteActivityCategory);
router.post(
  '/admin/activities',
  activityImageUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: 20 },
  ]),
  parseActivityPayload,
  validateRequest(activityAdminSchema),
  createActivity
);
router.get('/admin/activities/:id', getAdminActivity);
router.patch(
  '/admin/activities/:id',
  activityImageUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: 20 },
  ]),
  parseActivityPayload,
  validateRequest(activityAdminSchema),
  updateActivity
);
router.delete('/admin/activities/:id', deleteActivity);
router.patch('/admin/bookings/:id', validateRequest(updateBookingRequestSchema), updateBookingRequest);
router.patch('/admin/contacts/:id', validateRequest(updateContactRequestSchema), updateContactRequest);

export default router;

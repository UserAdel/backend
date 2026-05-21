import { Router } from 'express';
import {
  createActivityReview,
  getActivities,
  getActivityBySlug,
  getCategories,
} from '../controllers/activity.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { activityReviewSchema } from '../validations/request.validation.js';

const router = Router();

router.get('/activities', getActivities);
router.get('/activities/:slug', getActivityBySlug);
router.post('/activities/:slug/reviews', validateRequest(activityReviewSchema), createActivityReview);
router.get('/categories', getCategories);

export default router;

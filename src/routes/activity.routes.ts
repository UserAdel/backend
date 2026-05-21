import { Router } from 'express';
import {
  getActivities,
  getActivityBySlug,
  getCategories,
} from '../controllers/activity.controller.js';

const router = Router();

router.get('/activities', getActivities);
router.get('/activities/:slug', getActivityBySlug);
router.get('/categories', getCategories);

export default router;

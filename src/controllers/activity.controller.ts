import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';
import { Activity } from '../models/activity.model.js';
import { ActivityCategory } from '../models/activityCategory.model.js';

export const getActivities = asyncHandler(async (req: Request, res: Response) => {
  const { category, featured } = req.query;
  const filter: Record<string, unknown> = { isActive: true };

  if (typeof category === 'string' && category) {
    filter.category = category;
  }

  if (featured === 'true') {
    filter.featured = true;
  }

  const activities = await Activity.find(filter)
    .sort({ featured: -1, 'name.en': 1 })
    .lean();

  return successResponse(res, {
    data: { activities },
  });
});

export const getActivityBySlug = asyncHandler(async (req: Request, res: Response) => {
  const slug = req.params.slug;

  if (!slug) {
    throw new AppError('Activity slug is required', 400);
  }

  const activity = await Activity.findOne({
    slug,
    isActive: true,
  }).lean();

  if (!activity) {
    throw new AppError('Activity not found', 404);
  }

  return successResponse(res, {
    data: { activity },
  });
});

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await ActivityCategory.find({ isActive: true })
    .sort({ 'name.en': 1 })
    .lean();

  return successResponse(res, {
    data: { categories },
  });
});

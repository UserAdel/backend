import type { Request, Response } from 'express';
import { Testimonial } from '../models/testimonial.model.js';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';

export const getTestimonials = asyncHandler(async (_req: Request, res: Response) => {
  const testimonials = await Testimonial.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  return successResponse(res, {
    data: { testimonials },
  });
});

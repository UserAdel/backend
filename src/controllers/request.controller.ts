import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';
import { Activity } from '../models/activity.model.js';
import { BookingRequest } from '../models/bookingRequest.model.js';
import { ContactRequest } from '../models/contactRequest.model.js';

export const createBookingRequest = asyncHandler(async (req: Request, res: Response) => {
  const activity = await Activity.findOne({
    slug: req.body.selectedActivity,
    isActive: true,
  }).lean();

  if (!activity) {
    throw new AppError('Selected activity was not found', 404);
  }

  const booking = await BookingRequest.create({
    ...req.body,
    activityName: activity.name.en,
  });

  return successResponse(res, {
    message: 'Booking request saved',
    statusCode: 201,
    data: { booking },
  });
});

export const createContactRequest = asyncHandler(async (req: Request, res: Response) => {
  const contact = await ContactRequest.create(req.body);

  return successResponse(res, {
    message: 'Contact request saved',
    statusCode: 201,
    data: { contact },
  });
});

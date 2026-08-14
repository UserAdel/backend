import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';
import { Activity } from '../models/activity.model.js';
import { BookingRequest } from '../models/bookingRequest.model.js';
import { ContactRequest } from '../models/contactRequest.model.js';
import { sendBookingConfirmation, sendAdminNewBookingAlert } from '../services/whatsapp.service.js';

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

  // Non-blocking notifications — customer confirmation + admin alert
  sendBookingConfirmation({
    fullName: booking.fullName,
    whatsapp: booking.whatsapp,
    activityName: activity.name.en,
    arrivalDate: booking.arrivalDate ?? '',
    preferredDate: booking.preferredDate,
    adults: booking.adults,
    children: booking.children,
    language: booking.language,
    nationality: booking.nationality,
    specialRequests: booking.specialRequests ?? '',
  });

  sendAdminNewBookingAlert({
    fullName: booking.fullName,
    whatsapp: booking.whatsapp,
    activityName: activity.name.en,
    arrivalDate: booking.arrivalDate ?? '',
    preferredDate: booking.preferredDate,
    adults: booking.adults,
    children: booking.children,
    language: booking.language,
    nationality: booking.nationality,
    specialRequests: booking.specialRequests ?? '',
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

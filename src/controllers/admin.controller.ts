import type { Request, Response } from 'express';
import path from 'node:path';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';
import { Activity } from '../models/activity.model.js';
import { ActivityCategory } from '../models/activityCategory.model.js';
import { BookingRequest } from '../models/bookingRequest.model.js';
import { ContactRequest } from '../models/contactRequest.model.js';
import { deleteFile, getRelativePathFromUrl } from '../utils/fileSystem.util.js';

function applyUploadedActivityImage(req: Request) {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const mainImage = files?.image?.[0];
  const imageUrl = mainImage ? `/uploads/activities/${mainImage.filename}` : req.body.imageUrl;
  const uploadedGalleryImages = files?.gallery?.map((file) => `/uploads/activities/${file.filename}`) ?? [];
  const galleryImages = Array.from(
    new Set([...(req.body.galleryImages ?? []), ...uploadedGalleryImages])
  ).filter((galleryImageUrl) => galleryImageUrl !== imageUrl);

  return {
    ...req.body,
    ...(imageUrl ? { imageUrl } : {}),
    galleryImages,
  };
}

async function deletePreviousUploadedImage(imageUrl: string | undefined) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;

  const relativePath = getRelativePathFromUrl(imageUrl);
  if (!relativePath) return;

  await deleteFile(path.resolve('public', relativePath));
}

async function deleteRemovedUploadedGalleryImages(
  previousGalleryImages: string[] | undefined,
  nextGalleryImages: string[] | undefined
) {
  const retainedImages = new Set(nextGalleryImages ?? []);
  const removedImages = (previousGalleryImages ?? []).filter(
    (imageUrl) => !retainedImages.has(imageUrl)
  );

  await Promise.all(removedImages.map((imageUrl) => deletePreviousUploadedImage(imageUrl)));
}

export const getAdminDashboard = asyncHandler(async (req: Request, res: Response) => {
  const [bookings, contacts, activities, categories] = await Promise.all([
    BookingRequest.find().sort({ createdAt: -1 }).lean(),
    ContactRequest.find().sort({ createdAt: -1 }).lean(),
    Activity.find().sort({ isActive: -1, featured: -1, 'name.en': 1 }).lean(),
    ActivityCategory.find().sort({ isActive: -1, 'name.en': 1 }).lean(),
  ]);

  return successResponse(res, {
    data: {
      stats: {
        activities: activities.filter((activity) => activity.isActive).length,
        bookings: bookings.length,
        newBookings: bookings.filter((booking) => booking.status === 'new').length,
        contacts: contacts.length,
        newContacts: contacts.filter((contact) => contact.status === 'new').length,
        categories: categories.filter((category) => category.isActive).length,
      },
      bookings,
      contacts,
      activities,
      categories,
    },
  });
});

export const createActivityCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await ActivityCategory.create({
    ...req.body,
    isActive: req.body.isActive ?? true,
  });

  return successResponse(res, {
    message: 'Activity category created',
    statusCode: 201,
    data: { category },
  });
});

export const updateActivityCategory = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = req.params.id;

  if (!categoryId) {
    throw new AppError('Activity category id is required', 400);
  }

  const category = await ActivityCategory.findByIdAndUpdate(categoryId, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!category) {
    throw new AppError('Activity category not found', 404);
  }

  return successResponse(res, {
    message: 'Activity category updated',
    data: { category },
  });
});

export const deleteActivityCategory = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = req.params.id;

  if (!categoryId) {
    throw new AppError('Activity category id is required', 400);
  }

  const category = await ActivityCategory.findByIdAndUpdate(
    categoryId,
    { isActive: false },
    { returnDocument: 'after', runValidators: true }
  );

  if (!category) {
    throw new AppError('Activity category not found', 404);
  }

  return successResponse(res, {
    message: 'Activity category archived',
    data: { category },
  });
});

export const createActivity = asyncHandler(async (req: Request, res: Response) => {
  const activity = await Activity.create({
    ...applyUploadedActivityImage(req),
    isActive: req.body.isActive ?? true,
  });

  return successResponse(res, {
    message: 'Activity created',
    statusCode: 201,
    data: { activity },
  });
});

export const getAdminActivity = asyncHandler(async (req: Request, res: Response) => {
  const activityId = req.params.id;

  if (!activityId) {
    throw new AppError('Activity id is required', 400);
  }

  const activity = await Activity.findById(activityId).lean();

  if (!activity) {
    throw new AppError('Activity not found', 404);
  }

  return successResponse(res, {
    data: { activity },
  });
});

export const updateActivity = asyncHandler(async (req: Request, res: Response) => {
  const activityId = req.params.id;

  if (!activityId) {
    throw new AppError('Activity id is required', 400);
  }

  const previousActivity = await Activity.findById(activityId).lean();
  if (!previousActivity) {
    throw new AppError('Activity not found', 404);
  }

  const updatePayload = applyUploadedActivityImage(req);
  const activity = await Activity.findByIdAndUpdate(activityId, updatePayload, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!activity) {
    throw new AppError('Activity not found', 404);
  }

  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  if (files?.image?.[0] && previousActivity.imageUrl !== activity.imageUrl) {
    await deletePreviousUploadedImage(previousActivity.imageUrl);
  }

  await deleteRemovedUploadedGalleryImages(
    previousActivity.galleryImages,
    activity.galleryImages
  );

  return successResponse(res, {
    message: 'Activity updated',
    data: { activity },
  });
});

export const deleteActivity = asyncHandler(async (req: Request, res: Response) => {
  const activityId = req.params.id;

  if (!activityId) {
    throw new AppError('Activity id is required', 400);
  }

  const activity = await Activity.findByIdAndUpdate(
    activityId,
    { isActive: false },
    { returnDocument: 'after', runValidators: true }
  );

  if (!activity) {
    throw new AppError('Activity not found', 404);
  }

  return successResponse(res, {
    message: 'Activity archived',
    data: { activity },
  });
});

export const updateBookingRequest = asyncHandler(async (req: Request, res: Response) => {
  const bookingId = req.params.id;

  if (!bookingId) {
    throw new AppError('Booking request id is required', 400);
  }

  const booking = await BookingRequest.findByIdAndUpdate(
    bookingId,
    {
      status: req.body.status,
      adminNotes: req.body.adminNotes,
    },
    { returnDocument: 'after', runValidators: true }
  );

  if (!booking) {
    throw new AppError('Booking request not found', 404);
  }

  return successResponse(res, {
    message: 'Booking request updated',
    data: { booking },
  });
});

export const updateContactRequest = asyncHandler(async (req: Request, res: Response) => {
  const contactId = req.params.id;

  if (!contactId) {
    throw new AppError('Contact request id is required', 400);
  }

  const contact = await ContactRequest.findByIdAndUpdate(
    contactId,
    {
      status: req.body.status,
      adminNotes: req.body.adminNotes,
    },
    { returnDocument: 'after', runValidators: true }
  );

  if (!contact) {
    throw new AppError('Contact request not found', 404);
  }

  return successResponse(res, {
    message: 'Contact request updated',
    data: { contact },
  });
});

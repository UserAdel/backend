import type { Request, Response } from 'express';
import path from 'node:path';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';
import { Activity } from '../models/activity.model.js';
import { ActivityCategory } from '../models/activityCategory.model.js';
import { BookingRequest } from '../models/bookingRequest.model.js';
import { ContactRequest } from '../models/contactRequest.model.js';
import { Payment } from '../models/payment.model.js';
import { deleteFile, getRelativePathFromUrl } from '../utils/fileSystem.util.js';

function getUploadedFilesByField(req: Request) {
  const files = req.files as
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  if (Array.isArray(files)) {
    return files.reduce<Record<string, Express.Multer.File[]>>((filesByField, file) => {
      filesByField[file.fieldname] = [...(filesByField[file.fieldname] ?? []), file];
      return filesByField;
    }, {});
  }

  return files ?? {};
}

function applyUploadedActivityImage(req: Request) {
  const files = getUploadedFilesByField(req);
  const mainImage = files?.image?.[0];
  const imageUrl = mainImage ? `/uploads/activities/${mainImage.filename}` : req.body.imageUrl;
  const uploadedGalleryImages = files?.gallery?.map((file) => `/uploads/activities/${file.filename}`) ?? [];
  const videoHighlights = (req.body.videoHighlights ?? []).map(
    (video: Record<string, unknown>, index: number) => {
      const thumbnailFile = files?.[`videoThumbnail_${index}`]?.[0];

      return {
        ...video,
        ...(thumbnailFile
          ? { thumbnail: `/uploads/activities/${thumbnailFile.filename}` }
          : {}),
      };
    }
  );
  const galleryImages = Array.from(
    new Set([...(req.body.galleryImages ?? []), ...uploadedGalleryImages])
  ).filter((galleryImageUrl) => galleryImageUrl !== imageUrl);

  return {
    ...req.body,
    ...(imageUrl ? { imageUrl } : {}),
    galleryImages,
    videoHighlights,
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

async function deleteRemovedUploadedVideoThumbnails(
  previousVideoHighlights: ReadonlyArray<{ thumbnail?: string | null }> | undefined,
  nextVideoHighlights: ReadonlyArray<{ thumbnail?: string | null }> | undefined
) {
  const nextThumbnails = new Set(
    (nextVideoHighlights ?? [])
      .map((video) => video.thumbnail)
      .filter(Boolean)
  );
  const removedThumbnails = (previousVideoHighlights ?? [])
    .map((video) => video.thumbnail)
    .filter((thumbnail): thumbnail is string => Boolean(thumbnail))
    .filter((thumbnail) => !nextThumbnails.has(thumbnail));

  await Promise.all(removedThumbnails.map((thumbnail) => deletePreviousUploadedImage(thumbnail)));
}

export const getAdminDashboard = asyncHandler(async (req: Request, res: Response) => {
  const [bookings, contacts, activities, categories] = await Promise.all([
    BookingRequest.find().sort({ createdAt: -1 }).lean(),
    ContactRequest.find().sort({ createdAt: -1 }).lean(),
    Activity.find().sort({ isActive: -1, featured: -1, 'name.en': 1 }).lean(),
    ActivityCategory.find().sort({ isActive: -1, 'name.en': 1 }).lean(),
  ]);
  const payments = await Payment.find({
    bookingRequestId: { $in: bookings.map((booking) => booking._id) },
  })
    .sort({ createdAt: -1 })
    .lean();
  const paymentsByBookingId = payments.reduce<Record<string, (typeof payments)[number]>>(
    (paymentMap, payment) => {
      const bookingId = String(payment.bookingRequestId);
      const currentPayment = paymentMap[bookingId];

      if (!currentPayment || (payment.status === 'success' && currentPayment.status !== 'success')) {
        paymentMap[bookingId] = payment;
      }

      return paymentMap;
    },
    {}
  );
  const bookingsWithPayments = bookings.map((booking) => {
    const payment = paymentsByBookingId[String(booking._id)];
    const status = payment?.status === 'pending' ? 'pending' : booking.status;

    return {
      ...booking,
      status,
      paidAmount: payment?.status === 'success' ? payment.amount : 0,
      payment: payment
        ? {
            amount: payment.amount,
            amountWithFees: payment.amountWithFees,
            status: payment.status,
            orderId: payment.orderId,
            transactionId: payment.transactionId,
            updatedAt: payment.updatedAt,
          }
        : null,
    };
  });

  return successResponse(res, {
    data: {
      stats: {
        activities: activities.filter((activity) => activity.isActive).length,
        bookings: bookings.length,
        newBookings: bookingsWithPayments.filter((booking) => booking.status === 'new').length,
        contacts: contacts.length,
        newContacts: contacts.filter((contact) => contact.status === 'new').length,
        categories: categories.filter((category) => category.isActive).length,
      },
      bookings: bookingsWithPayments,
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

  const files = getUploadedFilesByField(req);
  if (files?.image?.[0] && previousActivity.imageUrl !== activity.imageUrl) {
    await deletePreviousUploadedImage(previousActivity.imageUrl);
  }

  await deleteRemovedUploadedGalleryImages(
    previousActivity.galleryImages,
    activity.galleryImages
  );
  await deleteRemovedUploadedVideoThumbnails(
    previousActivity.videoHighlights,
    activity.videoHighlights
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

export const updateActivityReview = asyncHandler(async (req: Request, res: Response) => {
  const activityId = req.params.id;
  const reviewId = req.params.reviewId;

  if (!activityId || !reviewId) {
    throw new AppError('Activity id and review id are required', 400);
  }

  const activity = await Activity.findOneAndUpdate(
    { _id: activityId, 'reviews._id': reviewId },
    {
      $set: {
        'reviews.$.name': req.body.name,
        'reviews.$.country': req.body.country,
        'reviews.$.rating': req.body.rating,
        'reviews.$.comment': req.body.comment,
      },
    },
    { returnDocument: 'after', runValidators: true }
  );

  if (!activity) {
    throw new AppError('Activity review not found', 404);
  }

  const review = activity.reviews.find((item) => {
    const itemId = (item as { _id?: unknown })._id;
    return itemId?.toString() === reviewId;
  });

  return successResponse(res, {
    message: 'Activity review updated',
    data: { review },
  });
});

export const deleteActivityReview = asyncHandler(async (req: Request, res: Response) => {
  const activityId = req.params.id;
  const reviewId = req.params.reviewId;

  if (!activityId || !reviewId) {
    throw new AppError('Activity id and review id are required', 400);
  }

  const activity = await Activity.findOneAndUpdate(
    { _id: activityId, 'reviews._id': reviewId },
    { $pull: { reviews: { _id: reviewId } } },
    { returnDocument: 'after', runValidators: true }
  );

  if (!activity) {
    throw new AppError('Activity review not found', 404);
  }

  return successResponse(res, {
    message: 'Activity review deleted',
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

export const deleteContactRequest = asyncHandler(async (req: Request, res: Response) => {
  const contactId = req.params.id;

  if (!contactId) {
    throw new AppError('Contact request id is required', 400);
  }

  const contact = await ContactRequest.findByIdAndDelete(contactId);

  if (!contact) {
    throw new AppError('Contact request not found', 404);
  }

  return successResponse(res, {
    message: 'Contact request deleted',
    data: { contact },
  });
});

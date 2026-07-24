import type { Request, Response } from 'express';
import path from 'node:path';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';
import { Activity } from '../models/activity.model.js';
import { ActivityCategory } from '../models/activityCategory.model.js';
import { BookingRequest } from '../models/bookingRequest.model.js';
import { ContactRequest } from '../models/contactRequest.model.js';
import { SystemSetting } from '../models/systemSetting.model.js';
import { deleteFile, getRelativePathFromUrl } from '../utils/fileSystem.util.js';
import {
  deleteS3ObjectByUrl,
  getS3UploadUrl,
  uploadFileToS3,
} from '../services/s3Storage.service.js';

const activityUploadFolders = ['activities'];

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
  const imageUrl = mainImage
    ? getS3UploadUrl(mainImage, activityUploadFolders)
    : req.body.imageUrl;
  const uploadedGalleryImages =
    files?.gallery?.map((file) => getS3UploadUrl(file, activityUploadFolders)) ?? [];
  const videoHighlights = (req.body.videoHighlights ?? []).map(
    (video: Record<string, unknown>, index: number) => {
      const thumbnailFile = files?.[`videoThumbnail_${index}`]?.[0];

      return {
        ...video,
        ...(thumbnailFile
          ? { thumbnail: getS3UploadUrl(thumbnailFile, activityUploadFolders) }
          : {}),
      };
    }
  );
  const videoReviews = (req.body.videoReviews ?? []).map(
    (videoReview: Record<string, unknown>, index: number) => {
      const thumbnailFile = files?.[`videoReviewThumbnail_${index}`]?.[0];

      return {
        ...videoReview,
        ...(thumbnailFile
          ? { thumbnail: getS3UploadUrl(thumbnailFile, activityUploadFolders) }
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
    videoReviews,
  };
}

function getAllUploadedFiles(req: Request) {
  return Object.values(getUploadedFilesByField(req)).flat();
}

async function deleteStoredActivityImage(imageUrl: string | undefined) {
  if (!imageUrl) return;
  const relativePath = getRelativePathFromUrl(imageUrl);

  if (relativePath?.startsWith('uploads/')) {
    await deleteFile(path.resolve('public', relativePath));
    return;
  }

  await deleteS3ObjectByUrl(imageUrl);
}

async function deleteStoredActivityImages(imageUrls: string[]) {
  await Promise.all(
    Array.from(new Set(imageUrls)).map((imageUrl) => deleteStoredActivityImage(imageUrl))
  );
}

async function uploadActivityImages(req: Request) {
  const files = getAllUploadedFiles(req);
  const uploadedImageUrls: string[] = [];

  try {
    for (const file of files) {
      uploadedImageUrls.push(await uploadFileToS3(file, activityUploadFolders));
    }
  } catch (error) {
    await deleteStoredActivityImages(uploadedImageUrls);
    throw error;
  }

  return uploadedImageUrls;
}

async function deleteRemovedUploadedGalleryImages(
  previousGalleryImages: string[] | undefined,
  nextGalleryImages: string[] | undefined
) {
  const retainedImages = new Set(nextGalleryImages ?? []);
  const removedImages = (previousGalleryImages ?? []).filter(
    (imageUrl) => !retainedImages.has(imageUrl)
  );

  await Promise.all(removedImages.map((imageUrl) => deleteStoredActivityImage(imageUrl)));
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

  await Promise.all(removedThumbnails.map((thumbnail) => deleteStoredActivityImage(thumbnail)));
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
  const uploadedImageUrls = await uploadActivityImages(req);
  const categoryImage = uploadedImageUrls[0] || req.body.image || '';

  const category = await ActivityCategory.create({
    ...req.body,
    image: categoryImage,
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

  const uploadedImageUrls = await uploadActivityImages(req);
  const updatePayload = { ...req.body };
  if (uploadedImageUrls.length > 0) {
    updatePayload.image = uploadedImageUrls[0];
  }

  const category = await ActivityCategory.findByIdAndUpdate(categoryId, updatePayload, {
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
  const uploadedImageUrls = await uploadActivityImages(req);
  let activity;

  try {
    activity = await Activity.create({
      ...applyUploadedActivityImage(req),
      isActive: req.body.isActive ?? true,
    });
  } catch (error) {
    await deleteStoredActivityImages(uploadedImageUrls);
    throw error;
  }

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

  const uploadedImageUrls = await uploadActivityImages(req);
  const updatePayload = applyUploadedActivityImage(req);
  let activity;

  try {
    activity = await Activity.findByIdAndUpdate(activityId, updatePayload, {
      returnDocument: 'after',
      runValidators: true,
    });
  } catch (error) {
    await deleteStoredActivityImages(uploadedImageUrls);
    throw error;
  }

  if (!activity) {
    await deleteStoredActivityImages(uploadedImageUrls);
    throw new AppError('Activity not found', 404);
  }

  const files = getUploadedFilesByField(req);
  if (files?.image?.[0] && previousActivity.imageUrl !== activity.imageUrl) {
    await deleteStoredActivityImage(previousActivity.imageUrl);
  }

  await deleteRemovedUploadedGalleryImages(
    previousActivity.galleryImages,
    activity.galleryImages
  );
  await deleteRemovedUploadedVideoThumbnails(
    previousActivity.videoHighlights,
    activity.videoHighlights
  );
  await deleteRemovedUploadedVideoThumbnails(
    previousActivity.videoReviews,
    activity.videoReviews
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

export const getSystemSettings = asyncHandler(async (_req: Request, res: Response) => {
  let settings = await SystemSetting.findOne({ key: 'default' }).lean();

  if (!settings) {
    settings = {
      key: 'default',
      whatsappApiUrl: process.env.WHATSAPP_API_URL || '',
      whatsappApiKey: process.env.WHATSAPP_API_KEY || '',
      whatsappSessionId: process.env.WHATSAPP_SESSION_ID || 'main',
      adminPhone: process.env.ADMIN_PHONE || '',
    } as any;
  }

  return successResponse(res, {
    message: 'Settings retrieved',
    data: { settings },
  });
});

export const updateSystemSettings = asyncHandler(async (req: Request, res: Response) => {
  const { whatsappApiUrl, whatsappApiKey, whatsappSessionId, adminPhone } = req.body;

  const settings = await SystemSetting.findOneAndUpdate(
    { key: 'default' },
    {
      key: 'default',
      whatsappApiUrl: whatsappApiUrl ?? '',
      whatsappApiKey: whatsappApiKey ?? '',
      whatsappSessionId: whatsappSessionId ?? 'main',
      adminPhone: adminPhone ?? '',
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  return successResponse(res, {
    message: 'Settings updated successfully',
    data: { settings },
  });
});


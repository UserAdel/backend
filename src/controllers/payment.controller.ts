import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';
import { Payment } from '../models/payment.model.js';
import { BookingRequest } from '../models/bookingRequest.model.js';
import {
  createPaymentSession,
  calculateAmountWithFees,
  verifyWebhookSignature,
} from '../utils/kashier.service.js';

export const initiatePayment = asyncHandler(async (req: Request, res: Response) => {
  const { bookingRequestId, amount, customer } = req.body;

  if (!bookingRequestId || !amount || !customer?.name) {
    throw new AppError('Missing required payment details', 400);
  }

  const booking = await BookingRequest.findById(bookingRequestId);
  if (!booking) {
    throw new AppError('Booking request not found', 404);
  }

  const amountWithFees = calculateAmountWithFees(amount);
  const orderId = `Booking_${bookingRequestId}_${Date.now()}`;

  const payment = await Payment.create({
    orderId,
    bookingRequestId,
    amount,
    amountWithFees,
    status: 'pending',
    customer,
  });

  const sessionResponse = await createPaymentSession({
    amount: amountWithFees,
    merchantOrderId: orderId,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
  });

  if (!sessionResponse?.sessionUrl) {
    throw new AppError('Failed to create payment session', 500);
  }

  return successResponse(res, {
    message: 'Payment session created',
    statusCode: 200,
    data: {
      orderId,
      amountWithFees,
      sessionUrl: sessionResponse.sessionUrl,
    },
  });
});

export const handleKashierWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-kashier-signature'] as string;

  if (
    process.env.KASHIER_MODE !== 'test' &&
    !verifyWebhookSignature(req.body, signature)
  ) {
    throw new AppError('Invalid signature', 401);
  }

  const { data } = req.body;
  const merchantOrderId = data.merchantOrderId as string;
  const transactionId = data.transactionId as string;
  const status = data.status as string;

  const payment = await Payment.findOne({ orderId: merchantOrderId });

  if (payment) {
    if (status === 'SUCCESS') {
      payment.status = 'success';
      payment.transactionId = transactionId;
      payment.paymentDetails = {
        ...(payment.paymentDetails || {}),
        kashierResponse: data,
      };
      await payment.save();

      await BookingRequest.findByIdAndUpdate(payment.bookingRequestId, {
        status: 'new',
      });
    } else if (status === 'FAILED') {
      payment.status = 'failed';
      payment.paymentDetails = {
        ...(payment.paymentDetails || {}),
        kashierResponse: data,
      };
      await payment.save();
    }
  }

  return successResponse(res, {
    message: 'Webhook processed',
    statusCode: 200,
    data: null,
  });
});

export const handlePaymentSuccess = asyncHandler(async (req: Request, res: Response) => {
  const merchantOrderId = req.query['merchantOrderId'] as string;
  const paymentStatus = req.query['paymentStatus'] as string;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (paymentStatus === 'SUCCESS') {
    return res.redirect(
      `${frontendUrl}/payment-status?status=success&orderId=${merchantOrderId}`
    );
  }

  return res.redirect(
    `${frontendUrl}/payment-status?status=failed&orderId=${merchantOrderId}`
  );
});

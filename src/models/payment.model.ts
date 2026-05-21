import { Schema, model, type InferSchemaType } from 'mongoose';

const paymentSchema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    bookingRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'BookingRequest',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    amountWithFees: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    transactionId: {
      type: String,
    },
    paymentDetails: {
      type: Schema.Types.Mixed,
    },
    customer: {
      name: { type: String, required: true },
      email: String,
      phone: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type PaymentDocument = InferSchemaType<typeof paymentSchema>;

export const Payment = model<PaymentDocument>('Payment', paymentSchema);

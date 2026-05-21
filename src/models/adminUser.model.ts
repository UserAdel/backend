import { Schema, model, type InferSchemaType } from 'mongoose';

const adminUserSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, default: 'Admin' },
    role: { type: String, enum: ['admin'], default: 'admin' },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type AdminUserDocument = InferSchemaType<typeof adminUserSchema>;

export const AdminUser = model<AdminUserDocument>('AdminUser', adminUserSchema);

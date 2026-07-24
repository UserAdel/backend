import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemSetting extends Document {
  key: string;
  whatsappApiUrl: string;
  whatsappApiKey: string;
  whatsappSessionId: string;
  adminPhone: string;
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingSchema = new Schema<ISystemSetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    whatsappApiUrl: {
      type: String,
      default: '',
    },
    whatsappApiKey: {
      type: String,
      default: '',
    },
    whatsappSessionId: {
      type: String,
      default: 'main',
    },
    adminPhone: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const SystemSetting = mongoose.model<ISystemSetting>('SystemSetting', systemSettingSchema);

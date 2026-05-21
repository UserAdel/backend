import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';
import { AdminUser } from '../models/adminUser.model.js';

export const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
  const phone = String(req.body.phone ?? '').trim();
  const password = String(req.body.password ?? '').trim();
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new AppError('Admin authentication is not configured', 500);
  }

  const admin = await AdminUser.findOne({ phone, isActive: true }).select('+passwordHash');
  const passwordMatches = admin ? await bcrypt.compare(password, admin.passwordHash) : false;

  if (!admin || !passwordMatches) {
    throw new AppError('Invalid phone number or password', 401);
  }

  const token = jwt.sign(
    {
      sub: String(admin._id),
      role: 'admin',
      phone,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  return successResponse(res, {
    message: 'Admin login successful',
    data: {
      token,
      user: {
        id: String(admin._id),
        name: admin.name,
        phone: admin.phone,
        role: 'admin',
      },
    },
  });
});

import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/globalErrorHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import AppError from '../utils/AppError.util.js';

const getAdminCredentials = () => ({
  phone: process.env.ADMIN_PHONE,
  password: process.env.ADMIN_PASSWORD,
  jwtSecret: process.env.JWT_SECRET,
});

export const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { phone, password } = req.body;
  const admin = getAdminCredentials();

  if (!admin.phone || !admin.password || !admin.jwtSecret) {
    throw new AppError('Admin authentication is not configured', 500);
  }

  if (phone !== admin.phone || password !== admin.password) {
    throw new AppError('Invalid phone number or password', 401);
  }

  const token = jwt.sign(
    {
      sub: 'admin',
      role: 'admin',
      phone: admin.phone,
    },
    admin.jwtSecret,
    { expiresIn: '7d' }
  );

  return successResponse(res, {
    message: 'Admin login successful',
    data: {
      token,
      user: {
        id: 'admin',
        name: 'Admin',
        phone: admin.phone,
        role: 'admin',
      },
    },
  });
});

import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import AppError from '../utils/AppError.util.js';

interface AdminTokenPayload {
  sub: string;
  role: string;
  phone: string;
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token) {
    return next(new AppError('Admin authentication required', 401));
  }

  if (!jwtSecret) {
    return next(new AppError('Admin authentication is not configured', 500));
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as AdminTokenPayload;

    if (payload.role !== 'admin') {
      return next(new AppError('Admin access required', 403));
    }

    return next();
  } catch {
    return next(new AppError('Invalid or expired admin session', 401));
  }
}

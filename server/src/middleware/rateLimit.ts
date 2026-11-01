import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors';

export const globalRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP globally
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, nextFn) => {
      nextFn(AppError.tooManyRequests('Too many requests, please try again in a minute'));
    },
  })(req, res, next);
};

export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 per minute on /api/auth/*
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, nextFn) => {
      nextFn(AppError.tooManyRequests('Too many authentication attempts, please try again in a minute'));
    },
  })(req, res, next);
};

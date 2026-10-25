import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

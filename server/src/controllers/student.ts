import { Request, Response, NextFunction } from 'express';
import * as attemptService from '../services/attempt';

export const joinQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizInfo = await attemptService.joinQuizByCode(req.body.accessCode, req.user!.id);
    return res.status(200).json(quizInfo);
  } catch (error) {
    next(error);
  }
};

export const startAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempt = await attemptService.startOrResumeAttempt(req.params.id, req.user!.id);
    return res.status(200).json(attempt);
  } catch (error) {
    next(error);
  }
};

export const getStudentQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizzes = await attemptService.getStudentQuizzes(req.user!.id);
    return res.status(200).json(quizzes);
  } catch (error) {
    next(error);
  }
};

export const getStudentAttempts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await attemptService.getStudentAttempts(req.user!.id);
    return res.status(200).json(attempts);
  } catch (error) {
    next(error);
  }
};

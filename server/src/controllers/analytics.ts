import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analytics';
import { AttemptsQuerySchema } from '../schemas/analytics';

export const getQuizAttempts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as unknown as AttemptsQuerySchema;
    const result = await analyticsService.getQuizAttemptsForTeacher(
      req.params.id,
      req.user!.id,
      query,
    );
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAttemptReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await analyticsService.getAttemptReviewForTeacher(
      req.params.id,
      req.user!.id,
    );
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getQuizAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await analyticsService.getQuizAnalytics(
      req.params.id,
      req.user!.id,
    );
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const exportQuizResultsCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csvData = await analyticsService.exportQuizResultsCsv(
      req.params.id,
      req.user!.id,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quiz-${req.params.id}-results.csv"`);
    return res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};

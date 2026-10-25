import { Request, Response, NextFunction } from 'express';
import * as questionService from '../services/question';

export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = await questionService.updateQuestion(req.params.id, req.user!.id, req.body);
    return res.status(200).json(question);
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await questionService.deleteQuestion(req.params.id, req.user!.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

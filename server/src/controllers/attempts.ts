import { Request, Response, NextFunction } from 'express';
import * as attemptService from '../services/attempt';

export const getAttemptState = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await attemptService.getAttemptState(req.params.id, req.user!.id);
    return res.status(200).json(state);
  } catch (error) {
    next(error);
  }
};

export const saveAnswer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const answer = await attemptService.saveAnswer(req.params.id, req.user!.id, req.body);
    return res.status(200).json(answer);
  } catch (error) {
    next(error);
  }
};

export const recordTabSwitch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await attemptService.recordTabSwitch(req.params.id, req.user!.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const submitAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await attemptService.submitAttempt(req.params.id, req.user!.id, false);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAttemptResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await attemptService.getAttemptResult(req.params.id, req.user!.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

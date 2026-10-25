import { Request, Response, NextFunction } from 'express';
import * as quizService from '../services/quiz';
import * as questionService from '../services/question';
import { QuizListQuery } from '../schemas/quiz';

export const createQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quiz = await quizService.createQuiz(req.user!.id, req.body);
    return res.status(201).json(quiz);
  } catch (error) {
    next(error);
  }
};

export const listQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as unknown as QuizListQuery;
    const result = await quizService.getTeacherQuizzes(req.user!.id, query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getQuizById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quiz = await quizService.getTeacherQuizById(req.params.id, req.user!.id);
    return res.status(200).json(quiz);
  } catch (error) {
    next(error);
  }
};

export const updateQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quiz = await quizService.updateQuizSettings(req.params.id, req.user!.id, req.body);
    return res.status(200).json(quiz);
  } catch (error) {
    next(error);
  }
};

export const deleteQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await quizService.deleteQuiz(req.params.id, req.user!.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const publishQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quiz = await quizService.setPublishState(req.params.id, req.user!.id, req.body.isPublished);
    return res.status(200).json(quiz);
  } catch (error) {
    next(error);
  }
};

export const releaseResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quiz = await quizService.setResultsVisibility(
      req.params.id,
      req.user!.id,
      req.body.showResultsImmediately,
    );
    return res.status(200).json(quiz);
  } catch (error) {
    next(error);
  }
};

export const regenerateCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quiz = await quizService.regenerateAccessCode(req.params.id, req.user!.id);
    return res.status(200).json(quiz);
  } catch (error) {
    next(error);
  }
};

export const addQuestionToQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = await questionService.addQuestion(req.params.id, req.user!.id, req.body);
    return res.status(201).json(question);
  } catch (error) {
    next(error);
  }
};

export const reorderQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const questions = await questionService.reorderQuestions(
      req.params.id,
      req.user!.id,
      req.body.orderedIds,
    );
    return res.status(200).json(questions);
  } catch (error) {
    next(error);
  }
};

import { z } from 'zod';

export const createQuizSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().trim().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),
  durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute'),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxAttempts: z.number().int().min(1, 'Max attempts must be at least 1').default(1),
  passingPercent: z.number().int().min(0).max(100, 'Passing percent must be between 0 and 100').default(40),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showResultsImmediately: z.boolean().default(true),
});

export const updateQuizSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150, 'Title cannot exceed 150 characters').optional(),
  description: z.string().trim().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),
  durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute').optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxAttempts: z.number().int().min(1, 'Max attempts must be at least 1').optional(),
  passingPercent: z.number().int().min(0).max(100, 'Passing percent must be between 0 and 100').optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showResultsImmediately: z.boolean().optional(),
});

export const publishQuizSchema = z.object({
  isPublished: z.boolean(),
});

export const releaseResultsSchema = z.object({
  showResultsImmediately: z.boolean(),
});

export const quizListQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  pageSize: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 10)),
  search: z.string().trim().optional(),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type QuizListQuery = z.infer<typeof quizListQuerySchema>;

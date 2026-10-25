import { z } from 'zod';

export const createOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1, 'Option text is required').max(500, 'Option text cannot exceed 500 characters'),
  isCorrect: z.boolean().default(false),
  order: z.number().int().optional(),
});

export const createQuestionSchema = z.object({
  text: z.string().trim().min(1, 'Question text is required').max(2000, 'Question text cannot exceed 2000 characters'),
  type: z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'], {
    errorMap: () => ({ message: "Type must be 'MCQ_SINGLE', 'MCQ_MULTI', or 'TRUE_FALSE'" }),
  }),
  marks: z.number().positive('Marks must be greater than 0').default(1),
  negativeMarks: z.number().min(0, 'Negative marks cannot be negative').default(0),
  explanation: z.string().trim().max(2000, 'Explanation cannot exceed 2000 characters').optional().nullable(),
  order: z.number().int().optional(),
  options: z.array(createOptionSchema).min(2, 'A question must have at least 2 options'),
});

export const updateQuestionSchema = z.object({
  text: z.string().trim().min(1, 'Question text is required').max(2000, 'Question text cannot exceed 2000 characters').optional(),
  type: z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE']).optional(),
  marks: z.number().positive('Marks must be greater than 0').optional(),
  negativeMarks: z.number().min(0, 'Negative marks cannot be negative').optional(),
  explanation: z.string().trim().max(2000, 'Explanation cannot exceed 2000 characters').optional().nullable(),
  order: z.number().int().optional(),
  options: z.array(createOptionSchema).min(2, 'A question must have at least 2 options').optional(),
});

export const reorderQuestionsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1, 'orderedIds must contain at least one question ID'),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type CreateOptionInput = z.infer<typeof createOptionSchema>;

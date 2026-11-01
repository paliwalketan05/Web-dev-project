import { z } from 'zod';

export const joinQuizSchema = z.object({
  accessCode: z
    .string()
    .trim()
    .length(6, 'Access code must be exactly 6 characters')
    .transform((code) => code.toUpperCase()),
});

export const saveAnswerSchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
  selectedOptionIds: z.array(z.string()).default([]),
  markedForReview: z.boolean().default(false),
});

export type JoinQuizInput = z.infer<typeof joinQuizSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

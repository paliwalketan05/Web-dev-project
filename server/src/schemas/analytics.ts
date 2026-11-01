import { z } from 'zod';

export const attemptsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  pageSize: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 10)),
  search: z.string().trim().optional(),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED']).optional(),
});

export type AttemptsQuerySchema = z.infer<typeof attemptsQuerySchema>;

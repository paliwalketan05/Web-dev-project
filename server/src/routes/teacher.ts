import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { prisma } from '../utils/prisma';

const router = Router();

router.use(requireAuth);
router.use(requireRole(Role.TEACHER));

router.get('/stats', async (req: Request, res: Response) => {
  const teacherId = req.user!.id;

  const [quizzesCount, publishedQuizzesCount, attemptsCount, distinctStudents] = await Promise.all([
    prisma.quiz.count({ where: { teacherId } }),
    prisma.quiz.count({ where: { teacherId, isPublished: true } }),
    prisma.attempt.count({ where: { quiz: { teacherId } } }),
    prisma.attempt.findMany({
      where: { quiz: { teacherId } },
      distinct: ['studentId'],
      select: { studentId: true },
    }),
  ]);

  return res.status(200).json({
    quizzes: quizzesCount,
    publishedQuizzes: publishedQuizzesCount,
    attempts: attemptsCount,
    distinctStudents: distinctStudents.length,
  });
});

export default router;

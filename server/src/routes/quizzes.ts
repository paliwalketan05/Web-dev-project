import { Router } from 'express';
import { Role } from '@prisma/client';
import * as quizzesController from '../controllers/quizzes';
import * as studentController from '../controllers/student';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createQuizSchema,
  updateQuizSchema,
  publishQuizSchema,
  releaseResultsSchema,
  quizListQuerySchema,
} from '../schemas/quiz';
import {
  createQuestionSchema,
  reorderQuestionsSchema,
} from '../schemas/question';
import { joinQuizSchema } from '../schemas/attempt';

const router = Router();

// All quiz routes require authentication
router.use(requireAuth);

// Student Quiz Endpoints
router.post('/join', requireRole(Role.STUDENT), validate({ body: joinQuizSchema }), studentController.joinQuiz);
router.post('/:id/attempts', requireRole(Role.STUDENT), studentController.startAttempt);

// Teacher Quiz Endpoints
router.post('/', requireRole(Role.TEACHER), validate({ body: createQuizSchema }), quizzesController.createQuiz);
router.get('/', requireRole(Role.TEACHER), validate({ query: quizListQuerySchema }), quizzesController.listQuizzes);
router.get('/:id', requireRole(Role.TEACHER), quizzesController.getQuizById);
router.put('/:id', requireRole(Role.TEACHER), validate({ body: updateQuizSchema }), quizzesController.updateQuiz);
router.delete('/:id', requireRole(Role.TEACHER), quizzesController.deleteQuiz);

router.patch('/:id/publish', requireRole(Role.TEACHER), validate({ body: publishQuizSchema }), quizzesController.publishQuiz);
router.patch(
  '/:id/release-results',
  requireRole(Role.TEACHER),
  validate({ body: releaseResultsSchema }),
  quizzesController.releaseResults,
);
router.post('/:id/regenerate-code', requireRole(Role.TEACHER), quizzesController.regenerateCode);

router.post(
  '/:id/questions',
  requireRole(Role.TEACHER),
  validate({ body: createQuestionSchema }),
  quizzesController.addQuestionToQuiz,
);
router.put(
  '/:id/questions/reorder',
  requireRole(Role.TEACHER),
  validate({ body: reorderQuestionsSchema }),
  quizzesController.reorderQuestions,
);

export default router;

import { Router } from 'express';
import { Role } from '@prisma/client';
import * as quizzesController from '../controllers/quizzes';
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

const router = Router();

// Protect all teacher quiz routes
router.use(requireAuth);
router.use(requireRole(Role.TEACHER));

router.post('/', validate({ body: createQuizSchema }), quizzesController.createQuiz);
router.get('/', validate({ query: quizListQuerySchema }), quizzesController.listQuizzes);
router.get('/:id', quizzesController.getQuizById);
router.put('/:id', validate({ body: updateQuizSchema }), quizzesController.updateQuiz);
router.delete('/:id', quizzesController.deleteQuiz);

router.patch('/:id/publish', validate({ body: publishQuizSchema }), quizzesController.publishQuiz);
router.patch(
  '/:id/release-results',
  validate({ body: releaseResultsSchema }),
  quizzesController.releaseResults,
);
router.post('/:id/regenerate-code', quizzesController.regenerateCode);

router.post(
  '/:id/questions',
  validate({ body: createQuestionSchema }),
  quizzesController.addQuestionToQuiz,
);
router.put(
  '/:id/questions/reorder',
  validate({ body: reorderQuestionsSchema }),
  quizzesController.reorderQuestions,
);

export default router;

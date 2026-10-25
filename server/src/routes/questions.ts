import { Router } from 'express';
import { Role } from '@prisma/client';
import * as questionsController from '../controllers/questions';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';
import { updateQuestionSchema } from '../schemas/question';

const router = Router();

// Protect all teacher question routes
router.use(requireAuth);
router.use(requireRole(Role.TEACHER));

router.put('/:id', validate({ body: updateQuestionSchema }), questionsController.updateQuestion);
router.delete('/:id', questionsController.deleteQuestion);

export default router;

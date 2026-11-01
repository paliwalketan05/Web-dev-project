import { Router } from 'express';
import { Role } from '@prisma/client';
import * as attemptsController from '../controllers/attempts';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validate } from '../middleware/validate';
import { saveAnswerSchema } from '../schemas/attempt';

const router = Router();

// Protect student attempt routes
router.use(requireAuth);

router.get('/:id/result', requireRole(Role.STUDENT), attemptsController.getAttemptResult);
router.put('/:id/answers', requireRole(Role.STUDENT), validate({ body: saveAnswerSchema }), attemptsController.saveAnswer);
router.post('/:id/tab-switch', requireRole(Role.STUDENT), attemptsController.recordTabSwitch);
router.post('/:id/submit', requireRole(Role.STUDENT), attemptsController.submitAttempt);
router.get('/:id', requireRole(Role.STUDENT), attemptsController.getAttemptState);

export default router;

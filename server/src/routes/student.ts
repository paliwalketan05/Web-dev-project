import { Router } from 'express';
import { Role } from '@prisma/client';
import * as studentController from '../controllers/student';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.use(requireAuth);
router.use(requireRole(Role.STUDENT));

router.get('/quizzes', studentController.getStudentQuizzes);
router.get('/attempts', studentController.getStudentAttempts);

export default router;

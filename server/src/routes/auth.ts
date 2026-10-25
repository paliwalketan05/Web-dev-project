import { Router } from 'express';
import * as authController from '../controllers/auth';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { registerSchema, loginSchema } from '../schemas/auth';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Rate limit applied to authentication endpoints
router.use(authRateLimiter);

router.post('/register', validate({ body: registerSchema }), authController.register);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.get('/me', requireAuth, authController.me);

export default router;

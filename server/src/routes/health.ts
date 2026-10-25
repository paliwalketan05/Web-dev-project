import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

const router = Router();

router.get('/health', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    // Run a trivial query against the database
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'ok', db: 'up' });
  } catch (error) {
    // If DB is unreachable or down
    console.error('Database health check failed:', error);
    return res.status(503).json({
      status: 'error',
      db: 'down',
      message: 'Database connection failed',
    });
  }
});

export default router;

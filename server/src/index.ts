import app from './app';
import { env } from './config/env';
import { prisma } from './utils/prisma';
import { startExpireAttemptsJob } from './jobs/expireAttempts';

let stopExpireJob: (() => void) | undefined;

const server = app.listen(env.PORT, async () => {
  console.log(`🚀 QuizArena API listening on port ${env.PORT} in ${env.NODE_ENV} mode`);

  try {
    // Quick test of database connection
    await prisma.$connect();
    console.log('✅ Connected to database successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database on startup:', error);
  }

  // Start background job to finalize expired attempts (every minute)
  if (env.NODE_ENV !== 'test') {
    stopExpireJob = startExpireAttemptsJob();
  }
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (stopExpireJob) {
    stopExpireJob();
  }
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Database disconnected. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database disconnect:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

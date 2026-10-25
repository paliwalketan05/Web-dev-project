import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/error';
import healthRouter from './routes/health';

const app = express();

// Trust proxy for Render / reverse proxy deployments
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS configuration - allow-list from CLIENT_URL only
const allowedOrigins = [env.CLIENT_URL];
// In development, also allow localhost variants if needed
if (env.NODE_ENV !== 'production') {
  if (!allowedOrigins.includes('http://localhost:5173')) {
    allowedOrigins.push('http://localhost:5173');
  }
  if (!allowedOrigins.includes('http://127.0.0.1:5173')) {
    allowedOrigins.push('http://127.0.0.1:5173');
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// JSON body parser with 100 kb limit
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Simple request logger
app.use((req, _res, next) => {
  if (env.NODE_ENV !== 'test') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Global rate limiter
app.use(globalRateLimiter);

// API Routes
app.use('/api', healthRouter);

// 404 Handler
app.use(notFoundHandler);

// Central Error Handler
app.use(errorHandler);

export default app;

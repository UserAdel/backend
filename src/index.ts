import './env.js';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { connectDB, mongoose } from './db/db.connection.js';
import { globalErrorHandler } from './utils/globalErrorHandler.util.js';
import activityRoutes from './routes/activity.routes.js';
import requestRoutes from './routes/request.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import testimonialRoutes from './routes/testimonial.routes.js';
import { startDailyDigestScheduler } from './services/scheduler.service.js';

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/hurghada_french_guide',
};

const app = express();

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('public/uploads'));

// App routes
app.get('/', (req: Request, res: Response) => {
  res.send('Hurghada French Guide API is running');
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, message: 'API is healthy' });
});

app.use('/api', activityRoutes);
app.use('/api', requestRoutes);
app.use('/api', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', testimonialRoutes);

// Global Error Handler 
app.use(globalErrorHandler);

// Start server after DB connection
const startServer = async () => {
  await connectDB(env.MONGODB_URI);
  startDailyDigestScheduler();
  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    try {
      await mongoose.connection.close();
      console.log('Mongoose connection closed');
      server.close(() => {
        console.log('Express server closed');
        process.exit(0);
      });
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
};

startServer();

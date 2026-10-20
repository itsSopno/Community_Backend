import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './Config/db';
import { errorHandler, notFound } from './middleware/error';

import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import registrationRoutes from './routes/registrationRoutes';
import aiRoutes from './routes/aiRoutes';

dotenv.config();

const app = express();

// ── Connect DB ─────────────────────────────────────────────────────────────────
connectDB();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'API is running 🚀', timestamp: new Date().toISOString() });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/ai', aiRoutes);

// ── Error Handling ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;

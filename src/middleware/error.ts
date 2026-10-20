import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const errorHandler = (
    err: Error & { code?: number; statusCode?: number; keyValue?: Record<string, string> },
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    console.error('❌ Error:', err.message);

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0];
        sendError(res, `${field} already exists.`, 409);
        return;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        sendError(res, err.message, 400);
        return;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        sendError(res, 'Invalid token.', 401);
        return;
    }
    if (err.name === 'TokenExpiredError') {
        sendError(res, 'Token expired.', 401);
        return;
    }

    sendError(res, err.message || 'Internal server error', err.statusCode || 500);
};

export const notFound = (_req: Request, res: Response): void => {
    sendError(res, 'Route not found', 404);
};

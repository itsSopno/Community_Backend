import { Request, Response, NextFunction } from 'express';

// ─── Typed Response Helpers ───────────────────────────────────────────────────

export const sendSuccess = (
    res: Response,
    data: unknown,
    message = 'Success',
    statusCode = 200
) => {
    res.status(statusCode).json({ success: true, message, data });
};

export const sendError = (
    res: Response,
    message = 'Something went wrong',
    statusCode = 500,
    errors?: unknown
) => {
    const body: { success: boolean; message: string; errors?: unknown } = {
        success: false,
        message,
    };
    if (errors !== undefined) body.errors = errors;
    res.status(statusCode).json(body);
};

// ─── Async Handler Wrapper ────────────────────────────────────────────────────

export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

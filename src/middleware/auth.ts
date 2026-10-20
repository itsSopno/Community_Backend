import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User, { IUser } from '../models/User';
import { sendError } from '../utils/response';

// Extend Express Request to carry the authenticated user
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

// ─── Authenticate ─────────────────────────────────────────────────────────────
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            sendError(res, 'Access denied. No token provided.', 401);
            return;
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            sendError(res, 'User not found.', 401);
            return;
        }

        req.user = user;
        next();
    } catch {
        sendError(res, 'Invalid or expired token.', 401);
    }
};

// ─── Authorize Roles ─────────────────────────────────────────────────────────
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            sendError(res, 'Authentication required.', 401);
            return;
        }
        if (!roles.includes(req.user.role)) {
            sendError(res, `Access denied. Requires role: ${roles.join(' or ')}.`, 403);
            return;
        }
        next();
    };
};

// ─── Organizer Only ───────────────────────────────────────────────────────────
export const organizerOnly = [authenticate, authorize('organizer')];

// ─── Volunteer Only ───────────────────────────────────────────────────────────
export const volunteerOnly = [authenticate, authorize('volunteer')];

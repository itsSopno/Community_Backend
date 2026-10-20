import { Request, Response } from 'express';
import User from '../models/User';
import { signToken } from '../utils/jwt';
import { asyncHandler, sendSuccess, sendError } from '../utils/response';

// ─── Register ─────────────────────────────────────────────────────────────────
export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        sendError(res, 'Name, email, and password are required.', 400);
        return;
    }

    // Prevent invalid role injection
    const allowedRoles = ['organizer', 'volunteer'];
    const userRole = allowedRoles.includes(role) ? role : 'volunteer';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        sendError(res, 'Email already registered.', 409);
        return;
    }

    const user = await User.create({ name, email, password, role: userRole });

    const token = signToken({ userId: user._id.toString(), role: user.role });

    sendSuccess(
        res,
        {
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        },
        'Registration successful',
        201
    );
});

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) {
        sendError(res, 'Email and password are required.', 400);
        return;
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        sendError(res, 'Invalid email or password.', 401);
        return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        sendError(res, 'Invalid email or password.', 401);
        return;
    }

    const token = signToken({ userId: user._id.toString(), role: user.role });

    sendSuccess(res, {
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    });
});

// ─── Get Me ───────────────────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.user!._id);
    if (!user) {
        sendError(res, 'User not found.', 404);
        return;
    }
    sendSuccess(res, user);
});

// ─── Update Profile ───────────────────────────────────────────────────────────
export const updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, bio, skills, interests, avatar } = req.body;

    const user = await User.findByIdAndUpdate(
        req.user!._id,
        { name, bio, skills, interests, avatar },
        { new: true, runValidators: true }
    );

    if (!user) {
        sendError(res, 'User not found.', 404);
        return;
    }

    sendSuccess(res, user, 'Profile updated');
});

// ─── Change Password ──────────────────────────────────────────────────────────
export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        sendError(res, 'Current and new password are required.', 400);
        return;
    }

    const user = await User.findById(req.user!._id).select('+password');
    if (!user) {
        sendError(res, 'User not found.', 404);
        return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        sendError(res, 'Current password is incorrect.', 401);
        return;
    }

    user.password = newPassword;
    await user.save();

    sendSuccess(res, null, 'Password changed successfully');
});

import { Router } from 'express';
import {
    register,
    login,
    getMe,
    updateProfile,
    completeProfile,
    changePassword,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/complete-profile', authenticate, completeProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

export default router;

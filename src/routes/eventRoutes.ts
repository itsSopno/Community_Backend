import { Router } from 'express';
import {
    createEvent,
    getAllEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    getMyEvents,
    getDashboardStats,
    getAnalytics,
} from '../controllers/eventController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/', getAllEvents);
router.get('/:id', getEventById);

// ── Organizer: dashboard & analytics ───────────────────────────────────────────
router.get('/organizer/my-events', authenticate, authorize('organizer'), getMyEvents);
router.get('/organizer/dashboard', authenticate, authorize('organizer'), getDashboardStats);
router.get('/organizer/analytics', authenticate, authorize('organizer'), getAnalytics);

// ── Organizer: event CRUD ───────────────────────────────────────────────────────
router.post('/', authenticate, authorize('organizer'), createEvent);
router.put('/:id', authenticate, authorize('organizer'), updateEvent);
router.delete('/:id', authenticate, authorize('organizer'), deleteEvent);

export default router;

import { Router } from 'express';
import {
    registerForEvent,
    cancelRegistration,
    getMyRegistrations,
    getEventRegistrations,
    updateRegistrationStatus,
} from '../controllers/registrationController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// ── Volunteer ──────────────────────────────────────────────────────────────────
router.post('/events/:eventId/register', authenticate, authorize('volunteer'), registerForEvent);
router.put('/:registrationId/cancel', authenticate, authorize('volunteer'), cancelRegistration);
router.get('/my-registrations', authenticate, authorize('volunteer'), getMyRegistrations);

// ── Organizer ──────────────────────────────────────────────────────────────────
router.get('/events/:eventId/registrations', authenticate, authorize('organizer'), getEventRegistrations);
router.put('/:registrationId/status', authenticate, authorize('organizer'), updateRegistrationStatus);

export default router;

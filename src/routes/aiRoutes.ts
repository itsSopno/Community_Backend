import { Router } from 'express';
import { generateEventContent } from '../controllers/aiController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Only organizers can use the AI assistant
router.post('/generate-event-content', authenticate, authorize('organizer'), generateEventContent);

export default router;

import { Request, Response } from 'express';
import Registration from '../models/Registration';
import Event, { IEvent } from '../models/Event';
import { asyncHandler, sendSuccess, sendError } from '../utils/response';

// ─── Register for Event (Volunteer) ───────────────────────────────────────────
export const registerForEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;
    const { selectedSkill, notes } = req.body;
    const volunteerId = req.user!._id;

    // 1. Check event exists and is published
    const event = await Event.findById(eventId);
    if (!event) {
        sendError(res, 'Event not found.', 404);
        return;
    }
    if (event.status !== 'published') {
        sendError(res, 'This event is not open for registration.', 400);
        return;
    }

    // 2. Check registration deadline
    if (new Date() > event.registrationDeadline) {
        sendError(res, 'Registration deadline has passed.', 400);
        return;
    }

    // 3. Check capacity
    if (event.registeredCount >= event.maxCapacity) {
        sendError(res, 'Event is at full capacity.', 400);
        return;
    }

    // 4. Check duplicate registration
    const existing = await Registration.findOne({ event: eventId, volunteer: volunteerId });
    if (existing) {
        if (existing.status === 'cancelled') {
            // Allow re-registration if previously cancelled
            existing.status = 'registered';
            existing.selectedSkill = selectedSkill || existing.selectedSkill;
            await existing.save();
            event.registeredCount += 1;
            await event.save();
            const populated = await existing.populate('event', 'title date location');
            sendSuccess(res, populated, 'Re-registered successfully', 200);
            return;
        }
        sendError(res, 'You are already registered for this event.', 409);
        return;
    }

    // 5. Create registration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registration = await (Registration as any).create({
        event: eventId,
        volunteer: volunteerId,
        selectedSkill: selectedSkill as string,
        notes: notes as string | undefined,
    });

    // Increment count
    await Event.findByIdAndUpdate(eventId, { $inc: { registeredCount: 1 } });

    // Auto-close if now full
    const updatedEvent = await Event.findById(eventId);
    if (updatedEvent && updatedEvent.registeredCount >= updatedEvent.maxCapacity) {
        await Event.findByIdAndUpdate(eventId, { status: 'closed' });
    }

    const populated = await registration.populate('event', 'title date location');
    sendSuccess(res, populated, 'Registered successfully', 201);
});

// ─── Cancel Registration (Volunteer) ──────────────────────────────────────────
export const cancelRegistration = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { registrationId } = req.params;
    const volunteerId = req.user!._id;

    const registration = await Registration.findById(registrationId).populate<{ event: IEvent }>('event');
    if (!registration) {
        sendError(res, 'Registration not found.', 404);
        return;
    }

    if (registration.volunteer.toString() !== volunteerId.toString()) {
        sendError(res, 'Not authorized to cancel this registration.', 403);
        return;
    }

    if (registration.status === 'cancelled') {
        sendError(res, 'Registration is already cancelled.', 400);
        return;
    }

    const event = registration.event as IEvent;
    if (!event) {
        sendError(res, 'Associated event not found.', 404);
        return;
    }
    if (new Date() >= event.date) {
        sendError(res, 'Cannot cancel registration for a past or ongoing event.', 400);
        return;
    }

    registration.status = 'cancelled';
    await registration.save();

    // Decrement count and re-open if was closed
    const updatePayload: Record<string, unknown> = { $inc: { registeredCount: -1 } };
    if (event.status === 'closed') {
        updatePayload.status = 'published';
    }
    await Event.findByIdAndUpdate(event._id, updatePayload);

    sendSuccess(res, registration, 'Registration cancelled');
});

// ─── Get Volunteer's Registrations ────────────────────────────────────────────
export const getMyRegistrations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, upcoming } = req.query as Record<string, string>;
    const volunteerId = req.user!._id;
    const now = new Date();

    const query: Record<string, unknown> = { volunteer: volunteerId };
    if (status) query.status = status;

    const registrations = await Registration.find(query)
        .populate<{ event: IEvent }>({
            path: 'event',
            select: 'title description date location category status maxCapacity registeredCount image',
            populate: { path: 'organizer', select: 'name email' },
        })
        .sort({ createdAt: -1 });

    // Filter by upcoming/past
    let filtered = registrations;
    if (upcoming === 'true') {
        filtered = registrations.filter((r) => r.event && (r.event as IEvent).date >= now);
    } else if (upcoming === 'false') {
        filtered = registrations.filter((r) => r.event && (r.event as IEvent).date < now);
    }

    sendSuccess(res, filtered);
});

// ─── Get Event Registrations (Organizer) ──────────────────────────────────────
export const getEventRegistrations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
        sendError(res, 'Event not found.', 404);
        return;
    }

    if (event.organizer.toString() !== req.user!._id.toString()) {
        sendError(res, 'Not authorized to view registrations for this event.', 403);
        return;
    }

    const registrations = await Registration.find({ event: eventId })
        .populate('volunteer', 'name email skills')
        .sort({ createdAt: -1 });

    sendSuccess(res, { event, registrations });
});

// ─── Update Registration Status (Organizer) ───────────────────────────────────
export const updateRegistrationStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { registrationId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['registered', 'confirmed', 'attended', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
        sendError(res, 'Invalid status value.', 400);
        return;
    }

    const registration = await Registration.findById(registrationId).populate<{ event: IEvent }>('event');
    if (!registration) {
        sendError(res, 'Registration not found.', 404);
        return;
    }

    const event = registration.event as IEvent;
    if (event.organizer.toString() !== req.user!._id.toString()) {
        sendError(res, 'Not authorized to update this registration.', 403);
        return;
    }

    const wasActive = registration.status !== 'cancelled';
    const willBeActive = status !== 'cancelled';

    registration.status = status;
    await registration.save();

    // Adjust count if cancellation state changed
    if (wasActive && !willBeActive) {
        await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: -1 } });
    } else if (!wasActive && willBeActive) {
        await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: 1 } });
    }

    sendSuccess(res, registration, 'Status updated successfully');
});

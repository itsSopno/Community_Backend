import { Request, Response } from 'express';
import Event from '../models/Event';
import Registration from '../models/Registration';
import { asyncHandler, sendSuccess, sendError } from '../utils/response';
import mongoose from 'mongoose';

// ─── Create Event (Organizer) ─────────────────────────────────────────────────
export const createEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
        title, description, date, location, category,
        maxCapacity, requiredSkills, registrationDeadline, image,
    } = req.body;

    const event = await Event.create({
        title, description, date, location, category,
        maxCapacity, requiredSkills, registrationDeadline, image,
        organizer: req.user!._id,
        status: 'draft',
    });

    sendSuccess(res, event, 'Event created successfully', 201);
});

// ─── Get All Events (Public – with filters) ────────────────────────────────────
export const getAllEvents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
        search, category, location, status,
        upcoming, page = '1', limit = '10',
    } = req.query as Record<string, string>;

    const query: Record<string, unknown> = {};

    if (search) {
        query.$text = { $search: search };
    }
    if (category) query.category = category;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (status) query.status = status;

    const now = new Date();
    if (upcoming === 'true') query.date = { $gte: now };
    if (upcoming === 'false') query.date = { $lt: now };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
        Event.find(query)
            .populate('organizer', 'name email')
            .sort({ date: 1 })
            .skip(skip)
            .limit(limitNum),
        Event.countDocuments(query),
    ]);

    sendSuccess(res, {
        events,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum),
        },
    });
});

// ─── Get Single Event (Public) ─────────────────────────────────────────────────
export const getEventById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findById(req.params.id).populate('organizer', 'name email');
    if (!event) {
        sendError(res, 'Event not found.', 404);
        return;
    }
    sendSuccess(res, event);
});

// ─── Update Event (Organizer – own events only) ───────────────────────────────
export const updateEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findById(req.params.id);
    if (!event) {
        sendError(res, 'Event not found.', 404);
        return;
    }

    if (event.organizer.toString() !== req.user!._id.toString()) {
        sendError(res, 'Not authorized to update this event.', 403);
        return;
    }

    const allowedFields = [
        'title', 'description', 'date', 'location', 'category',
        'maxCapacity', 'requiredSkills', 'registrationDeadline', 'status', 'image',
    ] as const;

    type AllowedField = typeof allowedFields[number];
    allowedFields.forEach((field: AllowedField) => {
        if (req.body[field] !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (event as any)[field] = req.body[field];
        }
    });

    await event.save();
    sendSuccess(res, event, 'Event updated successfully');
});

// ─── Delete Event (Organizer – own events only) ───────────────────────────────
export const deleteEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findById(req.params.id);
    if (!event) {
        sendError(res, 'Event not found.', 404);
        return;
    }

    if (event.organizer.toString() !== req.user!._id.toString()) {
        sendError(res, 'Not authorized to delete this event.', 403);
        return;
    }

    // Also remove all registrations for this event
    await Registration.deleteMany({ event: event._id });
    await Event.findByIdAndDelete(req.params.id);

    sendSuccess(res, null, 'Event deleted successfully');
});

// ─── Get Organizer's Events ───────────────────────────────────────────────────
export const getMyEvents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.query as Record<string, string>;
    const query: Record<string, unknown> = { organizer: req.user!._id };
    if (status) query.status = status;

    const events = await Event.find(query).sort({ createdAt: -1 });
    sendSuccess(res, events);
});

// ─── Organizer Dashboard Stats ────────────────────────────────────────────────
export const getDashboardStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const organizerId = req.user!._id;
    const now = new Date();

    const [totalEvents, upcomingEvents, completedEvents, registrations] = await Promise.all([
        Event.countDocuments({ organizer: organizerId }),
        Event.countDocuments({ organizer: organizerId, date: { $gte: now }, status: { $in: ['published', 'closed'] } }),
        Event.countDocuments({ organizer: organizerId, date: { $lt: now } }),
        Registration.countDocuments({ event: { $in: await Event.find({ organizer: organizerId }).distinct('_id') } }),
    ]);

    // Get upcoming events with capacity info
    const upcomingEventsList = await Event.find({
        organizer: organizerId,
        date: { $gte: now },
        status: { $in: ['published', 'closed'] },
    })
        .sort({ date: 1 })
        .limit(5);

    // Total available slots across all organizer's published events
    const allPublishedEvents = await Event.find({ organizer: organizerId, status: 'published' });
    const availableSlots = allPublishedEvents.reduce(
        (sum, e) => sum + Math.max(0, e.maxCapacity - e.registeredCount),
        0
    );

    sendSuccess(res, {
        totalEvents,
        upcomingEvents,
        completedEvents,
        totalVolunteers: registrations,
        availableSlots,
        upcomingEventsList,
    });
});

// ─── Analytics Data ────────────────────────────────────────────────────────────
export const getAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const organizerId = req.user!._id;
    const orgEvents = await Event.find({ organizer: organizerId });
    const eventIds = orgEvents.map((e) => e._id);

    // Events by category
    const eventsByCategory = await Event.aggregate([
        { $match: { organizer: new mongoose.Types.ObjectId(organizerId.toString()) } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    // Registrations by event
    const regByEvent = await Registration.aggregate([
        { $match: { event: { $in: eventIds } } },
        { $group: { _id: '$event', count: { $sum: 1 } } },
        {
            $lookup: {
                from: 'events',
                localField: '_id',
                foreignField: '_id',
                as: 'eventInfo',
            },
        },
        { $unwind: '$eventInfo' },
        { $project: { eventTitle: '$eventInfo.title', count: 1 } },
        { $sort: { count: -1 } },
    ]);

    // Registration status breakdown
    const statusBreakdown = await Registration.aggregate([
        { $match: { event: { $in: eventIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Capacity utilization per event
    const capacityUtilization = orgEvents.map((e) => ({
        title: e.title,
        maxCapacity: e.maxCapacity,
        registered: e.registeredCount,
        utilization: e.maxCapacity > 0 ? Math.round((e.registeredCount / e.maxCapacity) * 100) : 0,
    }));

    sendSuccess(res, {
        eventsByCategory,
        regByEvent,
        statusBreakdown,
        capacityUtilization,
    });
});

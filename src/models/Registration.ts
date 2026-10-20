import mongoose, { Document, Schema } from 'mongoose';

export type RegistrationStatus = 'registered' | 'confirmed' | 'attended' | 'cancelled';

export interface IRegistration extends Document {
    event: mongoose.Types.ObjectId;
    volunteer: mongoose.Types.ObjectId;
    selectedSkill: string;
    status: RegistrationStatus;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const registrationSchema = new Schema<IRegistration>(
    {
        event: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
        },
        volunteer: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        selectedSkill: {
            type: String,
            required: [true, 'Please select a skill for this event'],
            trim: true,
        },
        status: {
            type: String,
            enum: ['registered', 'confirmed', 'attended', 'cancelled'],
            default: 'registered',
        },
        notes: { type: String, maxlength: 500 },
    },
    { timestamps: true }
);

// Prevent duplicate registrations
registrationSchema.index({ event: 1, volunteer: 1 }, { unique: true });
registrationSchema.index({ volunteer: 1, status: 1 });
registrationSchema.index({ event: 1, status: 1 });

const Registration = mongoose.model<IRegistration>('Registration', registrationSchema);
export default Registration;

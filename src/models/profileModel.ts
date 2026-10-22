import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'organizer' | 'volunteer';

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    bio?: string;
    skills?: string[];
    interests?: string[];
    avatar?: string;
    image?: string;
    number?: string;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        role: {
            type: String,
            enum: ['organizer', 'volunteer'],
            default: 'volunteer',
        },
        bio: {
            type: String,
            maxlength: [500, 'Bio cannot exceed 500 characters'],
        },
        skills: [{ type: String, trim: true }],
        interests: [{ type: String, trim: true }],
        avatar: { type: String },
        image: {
            type: String,
            required: [true, 'iamge is import for indetification']
        }
    },
    { timestamps: true }
);

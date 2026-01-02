import { Document, Model, Schema, model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      default: "user",
      trim: true,
    },
  },
  { timestamps: true },
);

export const User: Model<IUser> = model<IUser>("User", userSchema);


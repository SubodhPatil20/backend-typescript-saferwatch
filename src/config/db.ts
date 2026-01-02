import mongoose from "mongoose";

export const connectDB = async (mongoUri: string): Promise<void> => {
  if (!mongoUri) {
    throw new Error("Missing MongoDB connection string");
  }

  await mongoose.connect(mongoUri);

  mongoose.connection.on("connected", () => {
    // eslint-disable-next-line no-console
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection error:", err);
  });
};







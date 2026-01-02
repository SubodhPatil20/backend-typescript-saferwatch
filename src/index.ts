import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";

const port = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGO_URI || "";

const start = async (): Promise<void> => {
  try {
    await connectDB(mongoUri);

    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

void start();







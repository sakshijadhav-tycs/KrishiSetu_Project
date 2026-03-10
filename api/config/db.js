import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      throw new Error("MONGO_URI is missing. Node cannot find your .env file.");
    }

    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error(`❌ Database Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;

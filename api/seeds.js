import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import Category from "./models/CategoryModel.js";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

const categories = [
  { name: "Vegetables", description: "Fresh farm vegetables" },
  { name: "Fruits", description: "Organic seasonal fruits" },
  { name: "Grains", description: "Wheat, Rice and Pulses" }
];

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing. Configure it in KrishiSetu/api/.env.");
    }

    await mongoose.connect(mongoUri);
    await Category.deleteMany();
    await Category.insertMany(categories);
    console.log("Categories seeded!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();

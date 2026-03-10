import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "./models/CategoryModel.js";

dotenv.config();

const categories = [
  { name: "Vegetables", description: "Fresh farm vegetables" },
  { name: "Fruits", description: "Organic seasonal fruits" },
  { name: "Grains", description: "Wheat, Rice and Pulses" }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://SakshiJadhav:sakshi%4007@cluster0.h4afbhb.mongodb.net/krishisetu_db?appName=Cluster0");
    await Category.deleteMany(); // Purana empty data saaf karein
    await Category.insertMany(categories);
    console.log("Categories Seeded! ✅");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();

import multer from "multer";
import fs from "fs";
import path from "path";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import {
  cloudinary,
  ensureCloudinaryConfigured,
  hasCloudinaryConfig,
} from "../config/cloudinary.js";

const uploadDir = "uploads/";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const sanitizeFileName = (fileName = "image") =>
  path
    .parse(fileName)
    .name.replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "image";

const getDiskStorage = () =>
  multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}-${sanitizeFileName(file.originalname)}${path.extname(file.originalname)}`);
    },
  });

const getCloudinaryStorage = (folder = "krishisetu") =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      public_id: `${Date.now()}-${sanitizeFileName(file.originalname)}`,
    }),
  });

const getStorage = (folder) =>
  hasCloudinaryConfig() && ensureCloudinaryConfigured()
    ? getCloudinaryStorage(folder)
    : getDiskStorage();

// File filter: Sirf images allow karne ke liye
const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images (jpeg, jpg, png, webp) are allowed"), false);
  }
};

export const createUpload = ({ folder = "krishisetu", fileSize = 1024 * 1024 * 5 } = {}) =>
  multer({
  storage: getStorage(folder),
  fileFilter: fileFilter,
  limits: { fileSize }, // 5MB limit
});

export const uploadMiddleware = (handler) => (req, res, next) => {
  handler(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Multer Error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

const upload = createUpload();

export default upload;

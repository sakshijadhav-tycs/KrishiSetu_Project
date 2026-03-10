import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Product from "../models/ProductModel.js";
import User from "../models/UserModel.js";
import Complaint from "../models/ComplaintModel.js";
import { cloudinary, ensureCloudinaryConfigured } from "../config/cloudinary.js";

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");

const currentFilePath = fileURLToPath(import.meta.url);
const apiRoot = path.resolve(path.dirname(currentFilePath), "..");
const uploadsRoot = path.join(apiRoot, "uploads");
const logsDir = path.join(apiRoot, "logs");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = path.join(logsDir, `image-migration-report-${timestamp}.json`);

const report = {
  startedAt: new Date().toISOString(),
  dryRun: isDryRun,
  uploadsRoot,
  summary: {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    missingFiles: 0,
    errors: 0,
  },
  collections: {
    products: { scanned: 0, migrated: 0, skipped: 0, missingFiles: 0, errors: 0 },
    users: { scanned: 0, migrated: 0, skipped: 0, missingFiles: 0, errors: 0 },
    complaints: { scanned: 0, migrated: 0, skipped: 0, missingFiles: 0, errors: 0 },
  },
  entries: [],
};

const isRemoteUrl = (value = "") => /^(https?:)?\/\//i.test(String(value).trim());
const isMigratableLocalPath = (value = "") => /^(\/)?uploads\//i.test(String(value).trim().replace(/\\/g, "/"));

const sanitizeLocalPath = (value = "") => String(value).trim().replace(/\\/g, "/").replace(/^\/+/, "");

const resolveLocalFilePath = (storedPath = "") => {
  const normalized = sanitizeLocalPath(storedPath);
  if (!normalized.toLowerCase().startsWith("uploads/")) return "";
  return path.join(apiRoot, normalized);
};

const ensureLogsDir = () => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

const mark = (collectionName, type) => {
  report.summary[type] += 1;
  report.collections[collectionName][type] += 1;
};

const pushEntry = (entry) => {
  report.entries.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
};

const uploadLocalFileToCloudinary = async (localFilePath, folder) => {
  return cloudinary.uploader.upload(localFilePath, {
    folder,
    resource_type: "image",
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });
};

const processImageValue = async ({
  collectionName,
  documentId,
  fieldPath,
  storedValue,
  cloudinaryFolder,
  applyUpdate,
}) => {
  mark(collectionName, "scanned");

  if (!storedValue || isRemoteUrl(storedValue)) {
    mark(collectionName, "skipped");
    pushEntry({
      collection: collectionName,
      documentId,
      fieldPath,
      status: "skipped",
      reason: storedValue ? "already_remote" : "empty_value",
      originalValue: storedValue || "",
    });
    return;
  }

  if (!isMigratableLocalPath(storedValue)) {
    mark(collectionName, "skipped");
    pushEntry({
      collection: collectionName,
      documentId,
      fieldPath,
      status: "skipped",
      reason: "not_local_upload_path",
      originalValue: storedValue,
    });
    return;
  }

  const localFilePath = resolveLocalFilePath(storedValue);
  if (!localFilePath || !fs.existsSync(localFilePath)) {
    mark(collectionName, "missingFiles");
    pushEntry({
      collection: collectionName,
      documentId,
      fieldPath,
      status: "missing_file",
      originalValue: storedValue,
      localFilePath,
    });
    return;
  }

  if (isDryRun) {
    mark(collectionName, "skipped");
    pushEntry({
      collection: collectionName,
      documentId,
      fieldPath,
      status: "dry_run",
      originalValue: storedValue,
      localFilePath,
      cloudinaryFolder,
    });
    return;
  }

  try {
    const uploadResult = await uploadLocalFileToCloudinary(localFilePath, cloudinaryFolder);
    await applyUpdate(uploadResult.secure_url);
    mark(collectionName, "migrated");
    pushEntry({
      collection: collectionName,
      documentId,
      fieldPath,
      status: "migrated",
      originalValue: storedValue,
      localFilePath,
      cloudinaryUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });
  } catch (error) {
    mark(collectionName, "errors");
    pushEntry({
      collection: collectionName,
      documentId,
      fieldPath,
      status: "error",
      originalValue: storedValue,
      localFilePath,
      error: error.message,
    });
  }
};

const migrateProducts = async () => {
  const products = await Product.find({ "images.0": { $exists: true } }).select("_id images");
  for (const product of products) {
    if (!Array.isArray(product.images) || product.images.length === 0) continue;

    let changed = false;
    const nextImages = [...product.images];

    for (let index = 0; index < product.images.length; index += 1) {
      const currentValue = product.images[index];
      await processImageValue({
        collectionName: "products",
        documentId: String(product._id),
        fieldPath: `images.${index}`,
        storedValue: currentValue,
        cloudinaryFolder: "krishisetu/products",
        applyUpdate: async (cloudinaryUrl) => {
          nextImages[index] = cloudinaryUrl;
          changed = true;
        },
      });
    }

    if (changed && !isDryRun) {
      product.images = nextImages;
      await product.save();
    }
  }
};

const migrateUsers = async () => {
  const users = await User.find({
    $or: [
      { profileImage: { $exists: true, $ne: "" } },
      { "kyc.documentImage": { $exists: true, $ne: "" } },
    ],
  }).select("_id profileImage kyc.documentImage");

  for (const user of users) {
    let changed = false;
    let nextProfileImage = user.profileImage || "";
    let nextDocumentImage = user.kyc?.documentImage || "";

    await processImageValue({
      collectionName: "users",
      documentId: String(user._id),
      fieldPath: "profileImage",
      storedValue: user.profileImage,
      cloudinaryFolder: "krishisetu/profiles",
      applyUpdate: async (cloudinaryUrl) => {
        nextProfileImage = cloudinaryUrl;
        changed = true;
      },
    });

    await processImageValue({
      collectionName: "users",
      documentId: String(user._id),
      fieldPath: "kyc.documentImage",
      storedValue: user.kyc?.documentImage,
      cloudinaryFolder: "krishisetu/kyc",
      applyUpdate: async (cloudinaryUrl) => {
        nextDocumentImage = cloudinaryUrl;
        changed = true;
      },
    });

    if (changed && !isDryRun) {
      user.profileImage = nextProfileImage;
      if (user.kyc) {
        user.kyc.documentImage = nextDocumentImage;
      }
      await user.save();
    }
  }
};

const migrateComplaints = async () => {
  const complaints = await Complaint.find({
    $or: [
      { imageUrl: { $exists: true, $ne: "" } },
      { "attachments.0": { $exists: true } },
    ],
  }).select("_id imageUrl attachments");

  for (const complaint of complaints) {
    let changed = false;
    let nextImageUrl = complaint.imageUrl || "";
    const nextAttachments = Array.isArray(complaint.attachments) ? [...complaint.attachments] : [];

    await processImageValue({
      collectionName: "complaints",
      documentId: String(complaint._id),
      fieldPath: "imageUrl",
      storedValue: complaint.imageUrl,
      cloudinaryFolder: "krishisetu/complaints",
      applyUpdate: async (cloudinaryUrl) => {
        nextImageUrl = cloudinaryUrl;
        changed = true;
      },
    });

    for (let index = 0; index < nextAttachments.length; index += 1) {
      const currentValue = nextAttachments[index];
      await processImageValue({
        collectionName: "complaints",
        documentId: String(complaint._id),
        fieldPath: `attachments.${index}`,
        storedValue: currentValue,
        cloudinaryFolder: "krishisetu/complaints",
        applyUpdate: async (cloudinaryUrl) => {
          nextAttachments[index] = cloudinaryUrl;
          changed = true;
        },
      });
    }

    if (changed && !isDryRun) {
      complaint.imageUrl = nextImageUrl;
      complaint.attachments = nextAttachments;
      await complaint.save();
    }
  }
};

const writeReport = () => {
  ensureLogsDir();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Migration report written to ${reportPath}`);
};

const main = async () => {
  try {
    ensureLogsDir();

    if (!ensureCloudinaryConfigured()) {
      throw new Error("Cloudinary is not configured. Check CLOUDINARY_* values in .env.");
    }

    await connectDB();
    await migrateProducts();
    await migrateUsers();
    await migrateComplaints();
    writeReport();

    console.log(`Image migration completed. Dry run: ${isDryRun}`);
    console.log(JSON.stringify(report.summary, null, 2));
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.fatalError = error.message;
    writeReport();
    console.error("Image migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
};

main();

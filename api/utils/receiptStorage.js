import path from "path";
import { ensureCloudinaryConfigured, cloudinary } from "../config/cloudinary.js";

const REMOTE_URL_PATTERN = /^https?:\/\//i;

export const isRemoteFileUrl = (value = "") => REMOTE_URL_PATTERN.test(String(value || "").trim());

export const resolveStoredFilePath = (projectRootDir, storedUrl = "", localStoredUrl = "") => {
  const candidate = !isRemoteFileUrl(localStoredUrl) && localStoredUrl ? localStoredUrl : storedUrl;
  if (!candidate || isRemoteFileUrl(candidate)) {
    return "";
  }

  return path.join(projectRootDir, String(candidate).replace(/^[/\\]+/, ""));
};

export const uploadReceiptToCloudinary = async ({
  localFilePath,
  orderId,
  receiptType = "receipt",
}) => {
  if (!localFilePath) {
    return { uploaded: false, secureUrl: "" };
  }

  if (!ensureCloudinaryConfigured()) {
    return { uploaded: false, secureUrl: "" };
  }

  try {
    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      folder: "krishisetu/receipts",
      resource_type: "raw",
      use_filename: true,
      unique_filename: true,
      public_id: `${receiptType}-${String(orderId || Date.now())}`,
    });

    return {
      uploaded: true,
      secureUrl: uploadResult.secure_url || "",
      publicId: uploadResult.public_id || "",
    };
  } catch (error) {
    console.error("RECEIPT_CLOUDINARY_UPLOAD_ERROR:", error?.message || error);
    return {
      uploaded: false,
      secureUrl: "",
      error,
    };
  }
};

import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    platformName: {
      type: String,
      default: "KrishiSetu",
    },
    supportEmail: {
      type: String,
      default: "support@krishisetu.local",
    },
    supportPhone: {
      type: String,
      default: "",
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: "",
    },
    defaultCommissionPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    minPayoutAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Single document collection for platform configuration
const Settings =
  mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);

export default Settings;


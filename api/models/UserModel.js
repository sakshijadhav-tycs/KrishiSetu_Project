/*
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const FARMER_ACCOUNT_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const normalizeFarmerAccountStatus = (status) => {
  const legacyMap = {
    active: FARMER_ACCOUNT_STATUS.PENDING,
    approved: FARMER_ACCOUNT_STATUS.APPROVED,
    rejected: FARMER_ACCOUNT_STATUS.REJECTED,
    suspended: FARMER_ACCOUNT_STATUS.SUSPENDED,
  };
  if (!status) return FARMER_ACCOUNT_STATUS.PENDING;
  return legacyMap[status] || status;
};

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: 6,
      select: false, // Security ke liye queries mein hidden rahega
    },
    role: {
      type: String,
      enum: ["consumer", "farmer", "admin"],
      default: "consumer",
    },
    // Overall account status used for admin farmer management
    accountStatus: {
      type: String,
      enum: ["active", "approved", "rejected", "suspended"],
      default: "active",
    },
    isverified: {
      type: Boolean,
      default: false,
    },
    token: {
      type: String,
    },
    phone: {
      type: String,
      required: function () {
        return this.role === "farmer";
      },
    },
    profileImage: {
      type: String,
      trim: true,
      default: "",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
    blockedReason: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    // --- Forgot Password Fields ---
    resetPasswordOTP: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date, // Controller ke sath sync karne ke liye 'Expires' spelling use karein
    },
  },
  {
    timestamps: true,
  }
);

// Password hashing logic
UserSchema.pre("save", async function (next) {
  // Agar password modify nahi hua hai toh aage badhein
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("User", UserSchema);
export default User;

*/
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// --- 1. CONSTANTS & HELPERS ---
const FARMER_ACCOUNT_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
};

// Helper to ensure status is always lowercase and valid
const normalizeFarmerAccountStatus = (status) => {
  if (!status) return FARMER_ACCOUNT_STATUS.PENDING;
  return status.toLowerCase();
};

// --- 2. USER SCHEMA ---
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: 6,
      select: false, // Hidden in queries for security
    },
    role: {
      type: String,
      enum: ["consumer", "farmer", "admin"],
      default: "consumer",
    },
    // Farmer account lifecycle status (admin managed)
    accountStatus: {
      type: String,
      enum: [
        FARMER_ACCOUNT_STATUS.PENDING,
        FARMER_ACCOUNT_STATUS.APPROVED,
        FARMER_ACCOUNT_STATUS.REJECTED,
        FARMER_ACCOUNT_STATUS.SUSPENDED,
        "active",
        "approved", // Redundant but kept for safety with existing data
        "rejected",
        "suspended",
      ],
      default: FARMER_ACCOUNT_STATUS.PENDING,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
    suspensionStartDate: {
      type: Date,
      default: null,
    },
    suspensionEndDate: {
      type: Date,
      default: null,
    },
    suspensionReason: {
      type: String,
      trim: true,
      default: "",
    },
    visitFeatureSuspended: {
      type: Boolean,
      default: false,
    },
    visitFeatureSuspendedReason: {
      type: String,
      trim: true,
      default: "",
    },
    visitFeatureSuspendedUntil: {
      type: Date,
      default: null,
    },
    isverified: {
      type: Boolean,
      default: false,
    },
    token: {
      type: String,
    },
    phone: {
      type: String,
      required: function () {
        return this.role === "farmer";
      },
    },
    profileImage: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    // --- KYC SECTION ---
    kyc: {
      status: {
        type: String,
        enum: ["none", "pending", "verified", "rejected"],
        default: "none",
      },
      documentType: {
        type: String,
        enum: ["Aadhaar Card", "PAN Card", "Voter ID", "Driving License"],
      },
      documentNumber: {
        type: String,
        trim: true,
      },
      documentImage: {
        type: String, // Path to the uploaded document file
      },
      rejectionReason: {
        type: String,
        default: "",
      },
      submittedAt: {
        type: Date,
      },
    },
    aadhaar_number: {
      type: String,
      trim: true,
      default: "",
    },
    mobile_number: {
      type: String,
      trim: true,
      default: "",
    },
    verification_status: {
      type: String,
      enum: ["verified", "unverified"],
      default: "unverified",
    },
    otp_verified: {
      type: Boolean,
      default: false,
    },
    verified_badge: {
      type: Boolean,
      default: false,
    },
    kyc_submitted_at: {
      type: Date,
      default: null,
    },
    kyc_verified_at: {
      type: Date,
      default: null,
    },
    verification_rejection_reason: {
      type: String,
      trim: true,
      default: "",
    },
    mobile_otp_code: {
      type: String,
      select: false,
      default: "",
    },
    mobile_otp_expires_at: {
      type: Date,
      default: null,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    resetPasswordOTP: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// --- 3. MIDDLEWARE (PRE-SAVE) ---
UserSchema.pre("save", async function (next) {
  // Normalize farmer status
  if (this.role === "farmer") {
    this.accountStatus = normalizeFarmerAccountStatus(this.accountStatus);
  }

  // Only hash password if it's new or being modified
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("User", UserSchema);
export default User;

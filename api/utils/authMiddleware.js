import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";

const ROLE_CONSUMER = "consumer";
const ROLE_USER = "user";
const ROLE_FARMER = "farmer";
const ROLE_ADMIN = "admin";

const hasAnyRole = (user, roles = []) =>
  Boolean(user?.role) && roles.includes(String(user.role));

/**
 * 1. Verify Token (Authentication Middleware)
 * Iska kaam hai check karna ki user logged in hai ya nahi.
 */
export const verifyToken = async (req, res, next) => {
  let token;

  // Header format check: Authorization: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Handle null/undefined string cases (common frontend bugs)
      if (!token || token === "null" || token === "undefined") {
        return res.status(401).json({ 
          success: false, 
          message: "Access Denied: Token missing or malformed" 
        });
      }

      // Token verify karna
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // User fetch karke request object mein attach karein (password hata kar)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(404).json({ 
          success: false, 
          message: "User session not found in database" 
        });
      }
      if ((req.user.role === ROLE_CONSUMER || req.user.role === ROLE_USER) && req.user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Your account is blocked. Please contact support.",
        });
      }

      next(); // Success! Agle middleware/controller par jao
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      
      // Specific error handling for expiry
      const message = error.name === "TokenExpiredError" 
        ? "Session expired, please login again" 
        : "Not authorized, token failed";

      return res.status(401).json({ success: false, message });
    }
  } else {
    return res.status(401).json({ 
      success: false, 
      message: "Not authorized, no token found in headers" 
    });
  }
};

/**
 * 2. Consumer Check
 */
export const isConsumer = (req, res, next) => {
  // Intentional backward-compatible behavior:
  // existing routes rely on admin passthrough in consumer-guarded paths.
  const allowedRoles = [ROLE_CONSUMER, ROLE_ADMIN, ROLE_USER];
  if (hasAnyRole(req.user, allowedRoles)) {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: "Access denied: Required Consumer or Admin role" 
    });
  }
};

/**
 * 3. Farmer Check
 */
export const isFarmer = (req, res, next) => {
  if (hasAnyRole(req.user, [ROLE_FARMER, ROLE_ADMIN])) {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: "Access denied: Required Farmer or Admin role" 
    });
  }
};

/**
 * 4. Admin Check
 */
export const isAdmin = (req, res, next) => {
  if (hasAnyRole(req.user, [ROLE_ADMIN])) {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: "Access denied: Admin privileges required" 
    });
  }
};

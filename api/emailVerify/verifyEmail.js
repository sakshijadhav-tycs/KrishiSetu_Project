import { sendEmail } from "../utils/sendEmail.js";

export const verifyEmail = async (token, email) => {
  const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
  const url = `${frontendBase}/verify-email?token=${token}`;

  try {
    const info = await sendEmail({
      email,
      subject: "Verify your KrishiSetu Account",
      eventType: "verify_email",
      entityType: "user",
      dedupeKey: `verify_email:${email}:${token}`,
      message: `Welcome to KrishiSetu! Verify your account using this link: ${url}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #2d6a4f;">Welcome to KrishiSetu!</h2>
          <p>Your account has been registered successfully. Please click the button below to verify your account:</p>
          <a href="${url}" style="background: #2d6a4f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
            Verify My Account
          </a>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">If the button doesn't work, please paste this link into your browser: <br/> ${url}</p>
        </div>
      `,
    });

    console.log("Verification email sent:", info?.messageId || "queued");
    return info;
  } catch (error) {
    console.error("Verification email error:", error.message);
    throw error;
  }
};

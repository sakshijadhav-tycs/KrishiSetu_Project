import { sendEmail } from "../utils/sendEmail.js";

export const forgotPasswordEmail = async (email, otp) => {
  try {
    await sendEmail({
      email,
      subject: "Password Reset Code - KrishiSetu",
      eventType: "forgot_password_otp",
      entityType: "user",
      dedupeKey: `forgot_password_otp:${email}:${otp}`,
      message: `Your KrishiSetu password reset code is ${otp}. It is valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2d5a27; text-align: center;">KrishiSetu</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Use the code below to proceed. This code is valid for 10 minutes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2d5a27; background: #f4fcf3; padding: 10px 20px; border-radius: 5px; border: 1px dashed #2d5a27;">
              ${otp}
            </span>
          </div>
          <p>If you did not request this, please ignore this email.</p>
          <p>Regards,<br />Team KrishiSetu</p>
        </div>
      `,
    });

    console.log("Forgot password OTP sent successfully to:", email);
  } catch (error) {
    console.error("Forgot password email error:", error.message);
    throw new Error("Email service failed");
  }
};

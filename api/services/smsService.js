import https from "https";
import { URLSearchParams } from "url";

const formatPhoneNumber = (rawNumber = "") => {
  const digits = String(rawNumber || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    const countryCode = String(process.env.SMS_DEFAULT_COUNTRY_CODE || "+91");
    return `${countryCode}${digits}`;
  }
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
};

const makeTwilioRequest = ({ accountSid, authToken, from, to, body }) =>
  new Promise((resolve, reject) => {
    const payload = new URLSearchParams({
      From: from,
      To: to,
      Body: body,
    }).toString();

    const request = https.request(
      {
        hostname: "api.twilio.com",
        path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          const parsed = data ? JSON.parse(data) : {};
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }
          reject(
            new Error(
              parsed?.message || `Twilio SMS failed with status ${response.statusCode}`
            )
          );
        });
      }
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });

export const sendOtpSms = async ({ mobileNumber, otp }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || "";
  const to = formatPhoneNumber(mobileNumber);
  const message = `Your KrishiSetu OTP is ${otp}. It is valid for 5 minutes.`;

  if (!accountSid || !authToken || !fromNumber) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMS provider is not configured");
    }
    return {
      success: false,
      simulated: true,
      message: "SMS provider not configured. OTP available in development response.",
    };
  }

  await makeTwilioRequest({
    accountSid,
    authToken,
    from: fromNumber,
    to,
    body: message,
  });

  return {
    success: true,
    simulated: false,
    message: "OTP sent successfully via SMS",
  };
};

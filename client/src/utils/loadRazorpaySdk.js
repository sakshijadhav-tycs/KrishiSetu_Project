const RAZORPAY_SCRIPT_ID = "razorpay-checkout-sdk";
const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export const loadRazorpaySdk = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Razorpay SDK")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });

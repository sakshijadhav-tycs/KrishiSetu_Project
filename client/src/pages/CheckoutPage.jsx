import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";
import {
  createOrder,
  createTransparentCheckout,
  verifyTransparentCheckout,
} from "../redux/slices/orderSlice";
import { clearCart } from "../redux/slices/cartSlice";
import { loadRazorpaySdk } from "../utils/loadRazorpaySdk";

const CheckoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const { cartItems = [] } = useSelector((state) => state.cart);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const [step, setStep] = useState(1);
  const [placingOrder, setPlacingOrder] = useState(false);
  const checkoutInProgressRef = useRef(false);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [currentCoords, setCurrentCoords] = useState({ lat: null, lng: null });
  const [formData, setFormData] = useState({
    fullName: userInfo?.name || "",
    address: "",
    locality: "",
    city: "",
    state: "",
    pincode: "",
    phone: userInfo?.phone || "",
    paymentMethod: "Razorpay",
    purchaseMode: "",
    subscriptionFrequency: "weekly",
    subscriptionStartDate: new Date().toISOString().split("T")[0],
  });

  const getErrorMessage = (error, fallback = "Something went wrong") => {
    if (!error) return fallback;
    if (typeof error === "string") return error;
    if (typeof error?.response?.data?.message === "string") return error.response.data.message;
    if (typeof error?.message === "string") return error.message;
    return fallback;
  };

  useEffect(() => {
    if (!userInfo?._id || !localStorage.getItem("token")) {
      toast.error("Please login to continue checkout");
      navigate("/login");
    }
  }, [navigate, userInfo]);

  const pricing = useMemo(() => {
    const productSubtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.qty || item.quantity || 0),
      0
    );
    const gstAmount = Number((productSubtotal * 0.05).toFixed(2));
    const deliveryCharge = 50;
    const totalAmount = Number((productSubtotal + gstAmount + deliveryCharge).toFixed(2));
    return { productSubtotal, gstAmount, deliveryCharge, totalAmount };
  }, [cartItems]);

  const states = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
  ];

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUseCurrentLocation = async () => {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocatingAddress(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      setCurrentCoords({ lat: latitude, lng: longitude });
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error("Unable to fetch address from your location");
      }

      const data = await response.json();
      const addressData = data?.address || {};

      const streetCandidates = [
        addressData.house_number,
        addressData.house_name,
        addressData.building,
        addressData.road,
        addressData.pedestrian,
        addressData.footway,
        addressData.street,
      ].filter(Boolean);

      const areaCandidates = [
        addressData.suburb,
        addressData.neighbourhood,
        addressData.quarter,
        addressData.residential,
        addressData.city_district,
        addressData.state_district,
        addressData.hamlet,
        addressData.village,
      ].filter(Boolean);

      const city =
        addressData.city ||
        addressData.town ||
        addressData.municipality ||
        addressData.county ||
        addressData.district ||
        addressData.village ||
        "";
      const stateFromApi = addressData.state || "";
      const postcode = addressData.postcode || "";
      const displayName = String(data?.display_name || "");

      const normalizeState = (value) =>
        String(value || "")
          .toLowerCase()
          .replace(/\b(state|union territory|ut)\b/g, "")
          .replace(/[^a-z\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();

      const normalizedApiState = normalizeState(stateFromApi);
      const matchedState =
        states.find((stateName) => normalizeState(stateName) === normalizedApiState) ||
        states.find((stateName) => normalizedApiState && normalizeState(stateName).includes(normalizedApiState)) ||
        "";

      const locality = areaCandidates[0] || "";
      let formattedAddress = [streetCandidates.join(" "), locality].filter(Boolean).join(", ").trim();

      if (!formattedAddress && displayName) {
        const parts = displayName
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        formattedAddress = parts.slice(0, 2).join(", ");
      }

      if (!formattedAddress && !locality && !city && !matchedState && !postcode) {
        throw new Error("No address found for your current location");
      }

      setFormData((prev) => ({
        ...prev,
        address: formattedAddress || prev.address,
        locality: locality || prev.locality,
        city: city || prev.city,
        state: matchedState || prev.state,
        pincode: postcode || prev.pincode,
      }));
    } catch (error) {
      if (error?.code === 1) {
        setLocationError("Location permission denied. Please allow location access.");
        return;
      }
      if (error?.code === 2) {
        setLocationError("Unable to detect your location right now.");
        return;
      }
      if (error?.code === 3) {
        setLocationError("Location request timed out. Please try again.");
        return;
      }

      setLocationError(getErrorMessage(error, "Failed to fetch current location"));
    } finally {
      setIsLocatingAddress(false);
    }
  };

  const isShippingValid = () => {
    return (
      formData.fullName &&
      formData.address &&
      (formData.city || formData.locality) &&
      formData.state &&
      formData.pincode &&
      formData.phone
    );
  };

  const isSubscriptionMode = formData.purchaseMode === "Subscription";
  const isSubscriptionConfigValid = () =>
    !isSubscriptionMode ||
    (["daily", "weekly", "monthly"].includes(formData.subscriptionFrequency) &&
      Boolean(formData.subscriptionStartDate));

  const cartPayload = cartItems.map((item) => ({
    productId: item.productId || item.product?._id || item._id,
    quantity: Number(item.qty || item.quantity || 1),
  }));

  const shippingAddress = {
    street: formData.address,
    locality: formData.locality,
    city: formData.city,
    state: formData.state,
    zipCode: formData.pincode,
    country: "India",
    coordinates:
      currentCoords.lat !== null && currentCoords.lng !== null
        ? { latitude: currentCoords.lat, longitude: currentCoords.lng }
        : undefined,
  };

  const handleTransparentPayment = async () => {
    if (checkoutInProgressRef.current || placingOrder) {
      return;
    }

    await loadRazorpaySdk();

    if (!window.Razorpay) {
      toast.error("Razorpay SDK not loaded");
      return;
    }

    checkoutInProgressRef.current = true;
    setPlacingOrder(true);
    try {
      const createResponse = await dispatch(
        createTransparentCheckout({
          items: cartPayload,
          shippingAddress,
          purchaseMode: "OneTime",
          paymentMethod: "razorpay",
        })
      ).unwrap();

      const checkoutData = createResponse.data || createResponse;
      const { intentId, razorpayOrder } = checkoutData;

      const token = localStorage.getItem("token");
      const { data: keyResponse } = await axios.get(`${API_URL}/getkey`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const razorpayKey = keyResponse?.key;
      if (!razorpayKey) {
        throw new Error("Razorpay key not configured on server");
      }

      const options = {
        key: razorpayKey,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || "INR",
        name: "कृषीSetu",
        description: "Transparent Farmer Marketplace Payment",
        order_id: razorpayOrder.id,
        prefill: {
          name: formData.fullName || userInfo?.name || "",
          contact: formData.phone || userInfo?.phone || "",
        },
        theme: { color: "#166534" },
        handler: async (response) => {
          try {
            const verifyResponse = await dispatch(
              verifyTransparentCheckout({
                intentId: String(intentId),
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
            ).unwrap();

            const verifyData = verifyResponse.data || verifyResponse;
            toast.success("Payment successful and order placed");
            navigate(
              `/paymentsuccess?reference=${response.razorpay_payment_id}&mainOrderId=${verifyData.mainOrderId}`
            );
          } catch (error) {
            toast.error(getErrorMessage(error, "Payment verification failed"));
          } finally {
            checkoutInProgressRef.current = false;
            setPlacingOrder(false);
          }
        },
        modal: {
          ondismiss: () => {
            checkoutInProgressRef.current = false;
            setPlacingOrder(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", () => {
        checkoutInProgressRef.current = false;
        setPlacingOrder(false);
      });
      razorpay.open();
    } catch (error) {
      checkoutInProgressRef.current = false;
      setPlacingOrder(false);
      toast.error(getErrorMessage(error, "Unable to initiate payment"));
    }
  };

  const handleSubscriptionCheckout = async () => {
    setPlacingOrder(true);
    try {
      const createResponse = await dispatch(
        createTransparentCheckout({
          items: cartPayload,
          shippingAddress,
          purchaseMode: "Subscription",
          paymentMethod: "cod",
          subscriptionConfig: {
            frequency: formData.subscriptionFrequency,
            startDate: formData.subscriptionStartDate,
          },
        })
      ).unwrap();

      const checkoutData = createResponse.data || createResponse;
      dispatch(clearCart());
      localStorage.removeItem("cartItems");

      if (checkoutData?.mainOrderId) {
        toast.success("Subscription created and first order generated");
        navigate(`/paymentsuccess?reference=COD-${checkoutData.mainOrderId}&mainOrderId=${checkoutData.mainOrderId}`);
        return;
      }

      toast.success("Subscription created successfully");
      navigate("/subscriptions");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create subscription"));
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleCOD = async () => {
    setPlacingOrder(true);
    try {
      const fallbackOrderData = {
        items: cartItems.map((item) => ({
          product: item.productId || item.product?._id || item._id,
          quantity: Number(item.qty || item.quantity || 1),
          price: Number(item.price || 0),
        })),
        totalAmount: pricing.totalAmount,
        orderType: "delivery",
        deliveryDetails: { address: shippingAddress },
        paymentMethod: "cash",
        paymentStatus: "unpaid",
      };
      const data = await dispatch(createOrder(fallbackOrderData)).unwrap();
      const orderId = data?.order?._id || data?._id || "COD";
      toast.success("Order placed with Cash on Delivery");
      navigate(`/paymentsuccess?reference=COD-${orderId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to place COD order"));
    } finally {
      setPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!cartItems.length) {
      toast.error("Your cart is empty");
      return;
    }
    if (!formData.purchaseMode) {
      toast.error("Please select purchase type");
      return;
    }
    if (!isSubscriptionConfigValid()) {
      toast.error("Please complete subscription details");
      return;
    }

    if (isSubscriptionMode) {
      await handleSubscriptionCheckout();
      return;
    }
    if (formData.paymentMethod === "Razorpay") {
      await handleTransparentPayment();
      return;
    }
    await handleCOD();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-12 relative">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="z-10 flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  step >= s
                    ? "bg-green-600 text-white shadow-md"
                    : "bg-white text-gray-400 border-2"
                }`}
              >
                {s}
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  step >= s ? "text-green-700" : "text-gray-400"
                }`}
              >
                {s === 1 ? "Shipping" : s === 2 ? "Purchase Type" : s === 3 ? "Payment" : "Invoice"}
              </span>
            </div>
          ))}
          <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200 -z-0" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-4">
                Shipping Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                <input name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                <div className="md:col-span-2">
                  <input name="address" placeholder="Complete Street Address" value={formData.address} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocatingAddress}
                    className="mt-2 w-full sm:w-auto px-4 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 font-semibold hover:bg-green-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLocatingAddress ? "Fetching location..." : "Use Current Location"}
                  </button>
                  {locationError && (
                    <p className="mt-2 text-xs text-red-600">{locationError}</p>
                  )}
                </div>
                <input name="locality" placeholder="Area / Locality" value={formData.locality} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                <input name="city" placeholder="City" value={formData.city} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                <select name="state" value={formData.state} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white cursor-pointer">
                  <option value="">Select State</option>
                  {states.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <input name="pincode" placeholder="Pincode" value={formData.pincode} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <button
                onClick={() => (isShippingValid() ? setStep(2) : toast.error("Please fill all shipping details"))}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 transition"
              >
                Next: Purchase Type
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-4">
                Select Purchase Type
              </h3>
              <label className={`border-2 p-6 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${formData.purchaseMode === "OneTime" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-green-200"}`}>
                <input
                  type="radio"
                  name="purchaseMode"
                  checked={formData.purchaseMode === "OneTime"}
                  onChange={() => setFormData((prev) => ({ ...prev, purchaseMode: "OneTime" }))}
                />
                <span className="font-bold">One-Time Purchase</span>
              </label>
              <label className={`border-2 p-6 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${formData.purchaseMode === "Subscription" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-green-200"}`}>
                <input
                  type="radio"
                  name="purchaseMode"
                  checked={formData.purchaseMode === "Subscription"}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      purchaseMode: "Subscription",
                      paymentMethod: "cash",
                    }))
                  }
                />
                <span className="font-bold">Subscribe & Save</span>
              </label>

              {isSubscriptionMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    name="subscriptionFrequency"
                    value={formData.subscriptionFrequency}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <input
                    type="date"
                    name="subscriptionStartDate"
                    value={formData.subscriptionStartDate}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <button onClick={() => setStep(1)} className="flex-1 border-2 py-3 rounded-xl font-bold hover:bg-gray-50 transition">
                  Back
                </button>
                <button onClick={() => (formData.purchaseMode && isSubscriptionConfigValid() ? setStep(3) : toast.error("Please select purchase type"))} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-md transition">
                  Next: Payment Method
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-4">
                Select Payment Method
              </h3>

              {!isSubscriptionMode && (
                <>
                  <div onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "Razorpay" }))} className={`border-2 p-6 rounded-xl flex items-center justify-between cursor-pointer transition-all ${formData.paymentMethod === "Razorpay" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-green-200"}`}>
                    <span className="font-bold">Razorpay (Transparent Split Order)</span>
                    <img src="https://razorpay.com/favicon.png" alt="RZP" className="w-8" />
                  </div>
                  <div onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "cash" }))} className={`border-2 p-6 rounded-xl flex items-center justify-between cursor-pointer transition-all ${formData.paymentMethod === "cash" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-green-200"}`}>
                    <span className="font-bold">Cash on Delivery</span>
                    <span className="text-2xl">Rs</span>
                  </div>
                </>
              )}

              {isSubscriptionMode && (
                <div className="border-2 border-green-600 bg-green-50 p-6 rounded-xl flex items-center justify-between">
                  <span className="font-bold">Cash on Delivery (Subscription Billing)</span>
                  <span className="text-2xl">Rs</span>
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <button onClick={() => setStep(2)} className="flex-1 border-2 py-3 rounded-xl font-bold hover:bg-gray-50 transition">
                  Back
                </button>
                <button onClick={() => setStep(4)} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-md transition">
                  Next: Invoice
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-4">
                Customer Invoice Preview
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Product Subtotal</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">Rs {pricing.productSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">GST (5%)</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">Rs {pricing.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Delivery Charges</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">Rs {pricing.deliveryCharge.toFixed(2)}</span>
                </div>
                <div className="border-t border-dashed border-gray-300 dark:border-gray-600 pt-3 flex justify-between text-lg">
                  <span className="font-black text-gray-700 dark:text-gray-100">Total Payment</span>
                  <span className="font-black text-green-700 dark:text-green-400">Rs {pricing.totalAmount.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(3)} className="flex-1 border-2 py-4 rounded-xl font-bold hover:bg-gray-50 transition">
                  Back
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={placingOrder}
                  className="flex-1 bg-green-700 text-white py-4 rounded-xl font-bold shadow-xl hover:bg-green-800 active:scale-95 transition-all disabled:opacity-70"
                >
                  {placingOrder
                    ? "Processing..."
                    : isSubscriptionMode
                      ? "Create Subscription"
                      : formData.paymentMethod === "cash"
                      ? "Place Order (COD)"
                      : "Pay Now"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;

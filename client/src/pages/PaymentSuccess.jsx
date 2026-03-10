import React, { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { clearCart } from "../redux/slices/cartSlice";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const referenceNum = searchParams.get("reference");
  const mainOrderId = searchParams.get("mainOrderId");
  const codOrderId = referenceNum?.startsWith("COD-")
    ? referenceNum.replace("COD-", "")
    : null;
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(clearCart());
  }, [dispatch]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white px-4 py-10">
      <div className="max-w-md w-full bg-white shadow-[0_20px_60px_rgba(22,101,52,0.10)] rounded-3xl p-8 text-center border border-green-100/70">
        <div className="flex justify-center mb-5">
          <div className="w-24 h-24 flex items-center justify-center bg-green-100 rounded-full shadow-lg ring-8 ring-green-50">
            <span className="text-4xl leading-none" aria-hidden="true">
              ✅
            </span>
          </div>
        </div>

        <span className="inline-flex items-center justify-center bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">
          Payment Successful
        </span>

        <h1 className="text-3xl font-black mt-4 text-gray-800 tracking-tight">
          🎉 Order Confirmed!
        </h1>

        <p className="text-gray-500 text-sm mt-2 leading-6">
          Thank you for shopping with KrishiSetu 🌱
        </p>

        <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-2xl p-5 mt-7 text-left text-sm text-gray-700 space-y-3 shadow-sm">
          <p>📦 Your order is being prepared for dispatch</p>
          <p>🚚 Delivery updates will appear in your order timeline</p>
          <p>
            💳 Payment {referenceNum?.startsWith("COD") ? "pending (COD)" : "completed successfully"}
          </p>
        </div>

        <div className="mt-6 text-left">
          <p className="text-xs text-gray-500 font-semibold mb-2">🔑 Transaction ID</p>
          <div className="bg-gray-100 rounded-xl px-4 py-3 font-mono text-sm text-slate-700 break-all select-all border border-gray-200">
            {referenceNum || "N/A"}
          </div>
        </div>

        <div className="mt-7 space-y-3">
          {(mainOrderId || codOrderId) && (
            <Link
              to={`/orders/${mainOrderId || codOrderId}${mainOrderId ? "?transparent=1" : ""}`}
              className="block w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3.5 rounded-xl font-semibold shadow-md hover:scale-[1.02] hover:shadow-lg transition-transform transition-shadow"
            >
              👁️ View Order Details
            </Link>
          )}

          <Link
            to="/orders"
            className="block w-full bg-green-800 text-white py-3.5 rounded-xl font-semibold shadow-md hover:bg-green-900 hover:scale-[1.02] transition-transform transition-colors"
          >
            📦 {t("paymentSuccess.checkOrders")}
          </Link>

          <Link
            to="/"
            className="block w-full border border-green-600 text-green-700 py-3.5 rounded-xl font-semibold hover:bg-green-50 hover:scale-[1.02] transition-transform transition-colors"
          >
            🛍️ {t("paymentSuccess.continueShopping")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;

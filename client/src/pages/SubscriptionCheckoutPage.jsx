import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { loadRazorpaySdk } from "../utils/loadRazorpaySdk";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SubscriptionCheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState(() => {
    const fromState = location.state?.subConfig || {};
    return {
      frequency: fromState.frequency || "daily",
      quantity: Number(fromState.quantity || 1),
      startDate: fromState.startDate || new Date().toISOString().split("T")[0],
      durationDays: Number(fromState.durationDays || 30),
      paymentMethod: "razorpay",
    };
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/products/${productId}`);
        setProduct(data.data || data);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId]);

  const total = useMemo(() => {
    const subtotal = Number(product?.price || 0) * Number(form.quantity || 1);
    return Number(subtotal.toFixed(2));
  }, [product, form.quantity]);

  const createSubscriptionOrder = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login first");
      navigate("/login");
      return;
    }

    const orderPayload = {
      items: [{ product: productId, quantity: Number(form.quantity) }],
      orderType: "delivery",
      paymentMethod: form.paymentMethod === "cod" ? "cod" : "razorpay",
      deliveryDetails: {
        address: {
          street: "Subscription delivery",
          city: "-",
          state: "-",
          zipCode: "-",
        },
      },
      subscription: {
        enabled: true,
        frequency: form.frequency,
        quantity: Number(form.quantity),
        startDate: form.startDate,
        durationDays: Number(form.durationDays),
      },
      notes: "Subscription checkout order",
    };

    const { data } = await axios.post(`${API_URL}/orders`, orderPayload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data?.order || data?.data || data;
  };

  const verifyRegularPayment = async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId }) => {
    const token = localStorage.getItem("token");
    await axios.post(
      `${API_URL}/orders/verify`,
      { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  const handleCheckout = async () => {
    try {
      setPlacing(true);
      const order = await createSubscriptionOrder();
      if (!order?._id) {
        throw new Error("Unable to create subscription order");
      }

      if (form.paymentMethod === "cod") {
        toast.success("Subscription created with COD");
        navigate(`/paymentsuccess?reference=COD-${order._id}`);
        return;
      }

      await loadRazorpaySdk();

      if (!window.Razorpay) {
        throw new Error("Razorpay SDK not loaded");
      }

      const { data: keyData } = await axios.get(`${API_URL}/getkey`);
      const options = {
        key: keyData?.key,
        amount: Math.round(Number(order.totalAmount || total) * 100),
        currency: "INR",
        name: "कृषीSetu",
        description: "Subscription Checkout",
        order_id: order.razorpayOrderId || order.razorpay_order_id,
        handler: async (response) => {
          try {
            await verifyRegularPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              dbOrderId: order._id,
            });
            toast.success("Subscription payment successful");
            navigate(`/paymentsuccess?reference=${response.razorpay_payment_id}`);
          } catch (err) {
            toast.error(err?.response?.data?.message || "Payment verification failed");
          }
        },
      };
      const rz = new window.Razorpay(options);
      rz.open();
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Checkout failed");
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!product) return <div className="p-6">Product not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-black text-gray-900">Subscribe & Checkout</h1>
        <p className="text-sm text-gray-500 mt-1">{product.name}</p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={form.frequency}
            onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
            className="p-3 border rounded-lg"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input
            type="number"
            min="1"
            value={form.quantity}
            onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value || 1) }))}
            className="p-3 border rounded-lg"
            placeholder="Quantity"
          />
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
            className="p-3 border rounded-lg"
          />
          <input
            type="number"
            min="1"
            value={form.durationDays}
            onChange={(e) => setForm((p) => ({ ...p, durationDays: Number(e.target.value || 30) }))}
            className="p-3 border rounded-lg"
            placeholder="Duration days"
          />
        </div>

        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Payment Method</p>
          <div className="flex gap-2">
            {["razorpay", "cod"].map((m) => (
              <button
                key={m}
                onClick={() => setForm((p) => ({ ...p, paymentMethod: m }))}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${
                  form.paymentMethod === m ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-600">First order amount</p>
          <p className="text-xl font-black text-green-700">Rs {total.toFixed(2)}</p>
        </div>

        <button
          onClick={handleCheckout}
          disabled={placing}
          className="w-full mt-6 py-3 rounded-xl bg-green-700 text-white font-black hover:bg-green-800 disabled:opacity-60"
        >
          {placing ? "Processing..." : "Subscribe & Checkout"}
        </button>
      </div>
    </div>
  );
};

export default SubscriptionCheckoutPage;

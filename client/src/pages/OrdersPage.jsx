"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaDownload, FaFileInvoice, FaFilter, FaShoppingBasket } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../components/Loader";
import {
  getConsumerOrders,
  getTransparentConsumerOrders,
  requestTransparentOrderReturn,
} from "../redux/slices/orderSlice";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const normalizeStatus = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "delivered";
  return normalized;
};
const displayStatus = (status = "") => String(status || "").replaceAll("_", " ");

const OrdersPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const { orders, transparentOrders, loading } = useSelector((state) => state.orders);

  useEffect(() => {
    dispatch(getConsumerOrders());
    dispatch(getTransparentConsumerOrders());
  }, [dispatch]);

  const mergedOrders = useMemo(() => {
    const regular = (orders || []).map((order) => ({
      id: order._id,
      createdAt: order.createdAt,
      status: normalizeStatus(order.status || "pending"),
      productSubtotal: Number(order.totalAmount || 0),
      gstAmount: 0,
      deliveryCharge: 0,
      totalAmount: Number(order.totalAmount || 0),
      paymentMethod: order.paymentMethod || "cod",
      paymentStatus: order.paymentStatus || "pending",
      isSubscriptionOrder: Boolean(order.isSubscriptionOrder),
      typeLabel: "Single Vendor",
      source: "regular",
    }));

    const split = (transparentOrders || []).map((order) => ({
      id: order._id,
      createdAt: order.createdAt,
      status: order.orderStatus || "created",
      productSubtotal: Number(order.productSubtotal || 0),
      gstAmount: Number(order.gstAmount || 0),
      deliveryCharge: Number(order.deliveryCharge || 0),
      totalAmount: Number(order.totalAmount || 0),
      paymentMethod: order.paymentMethod || "razorpay",
      paymentStatus: order.paymentStatus || "pending",
      isSubscriptionOrder: order.orderType === "subscription" || order.purchaseMode === "Subscription",
      typeLabel:
        order.orderType === "subscription"
          ? "Subscription Split"
          : order.orderType === "single" || Number(order.subOrderCount || 0) <= 1
            ? "Single Order"
            : "Split Order",
      source: "transparent",
      returnInfo: order.returnInfo || {
        hasEligibleReturn: false,
        returnStatus: "None",
      },
    }));

    return [...regular, ...split].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders, transparentOrders]);

  const filteredOrders = useMemo(() => {
    if (filter === "all") return mergedOrders;
    return mergedOrders.filter((order) => String(order.status || "").toLowerCase() === filter);
  }, [filter, mergedOrders]);

  const openOrderDetails = (order) => {
    const suffix = order.source === "transparent" ? "?transparent=1" : "";
    navigate(`/orders/${order.id}${suffix}`);
  };

  const downloadInvoice = async (order) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        return;
      }

      const endpoint = order.source === "transparent"
        ? `/transparent-orders/${order.id}/invoice`
        : (
          String(order.paymentStatus || "").toLowerCase() === "paid"
            ? `/orders/${order.id}/receipt`
            : `/orders/${order.id}/invoice`
        );

      const response = await axios.get(`${API_URL}${endpoint}`, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = response.headers["content-type"] || "application/pdf";
      const extension = contentType.includes("pdf") ? "pdf" : "bin";
      const url = URL.createObjectURL(new Blob([response.data], { type: contentType }));
      const link = document.createElement("a");
      link.href = url;
      const label = order.source === "transparent"
        ? "invoice-transparent"
        : (order.paymentStatus === "paid" ? "receipt" : "invoice");
      link.download = `${label}-${order.id}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to download file");
    }
  };

  const openReturnModal = (order) => {
    setReturnModalOrder(order);
    setReturnReason("");
  };

  const closeReturnModal = () => {
    if (returnSubmitting) return;
    setReturnModalOrder(null);
    setReturnReason("");
  };

  const handleReturnSubmit = async () => {
    const reason = String(returnReason || "").trim();
    if (!returnModalOrder || !reason) {
      return;
    }
    setReturnSubmitting(true);
    const result = await dispatch(
      requestTransparentOrderReturn({ id: returnModalOrder.id, reason })
    );
    setReturnSubmitting(false);
    if (!requestTransparentOrderReturn.fulfilled.match(result)) {
      return;
    }
    closeReturnModal();
    dispatch(getTransparentConsumerOrders());
  };

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="bg-white dark:bg-gray-800 px-6 py-6 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">
              My Orders
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-3 pb-2">
            <div className="flex items-center text-gray-400 mr-2 border-r pr-4 border-gray-200">
              <FaFilter className="mr-2" size={12} />
              <span className="text-[10px] font-black uppercase">Filter</span>
            </div>
            {["all", "pending", "accepted", "processing", "shipped", "delivered", "cancelled"].map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border ${
                  filter === value
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-400 border-gray-100 hover:border-green-200"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length > 0 ? (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <div
                key={`${order.source}-${order.id}`}
                className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Order ID
                    </p>
                    <p className="font-black text-gray-900 dark:text-gray-100">
                      #{order?.id?.slice(-8)?.toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.isSubscriptionOrder && (
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100">
                        Subscription
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-50 text-green-700 border border-green-100">
                      {order.typeLabel}
                    </span>
                    <span
                      className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-orange-50 text-orange-700 border-orange-100"
                    >
                      {displayStatus(order.status)}
                    </span>
                    {order.source === "transparent" &&
                      String(order.returnInfo?.returnStatus || "None") !== "None" && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-sky-50 text-sky-700 border-sky-100">
                          Return {order.returnInfo?.returnStatus}
                        </span>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <p className="text-[10px] uppercase text-gray-400 font-black">Subtotal</p>
                    <p className="font-black text-gray-900 dark:text-gray-100">Rs {Number(order.productSubtotal || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <p className="text-[10px] uppercase text-gray-400 font-black">GST</p>
                    <p className="font-black text-gray-900 dark:text-gray-100">Rs {Number(order.gstAmount || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <p className="text-[10px] uppercase text-gray-400 font-black">Delivery</p>
                    <p className="font-black text-gray-900 dark:text-gray-100">Rs {Number(order.deliveryCharge || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-100 dark:border-green-800">
                    <p className="text-[10px] uppercase text-green-500 font-black">Total</p>
                    <p className="font-black text-green-700 dark:text-green-400">Rs {Number(order.totalAmount || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    onClick={() => openOrderDetails(order)}
                    className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition"
                  >
                    View Order Details
                  </button>
                  <Link
                    to={`/orders/${order.id}${order.source === "transparent" ? "?transparent=1" : ""}`}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition"
                  >
                    <FaFileInvoice />
                    View Invoice
                  </Link>
                  <button
                    onClick={() => downloadInvoice(order)}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition"
                  >
                    <FaDownload />
                    Download Invoice
                  </button>
                  {order.source === "transparent" && order.returnInfo?.hasEligibleReturn && (
                    <button
                      onClick={() => openReturnModal(order)}
                      className="inline-flex items-center gap-2 bg-amber-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-700 transition"
                    >
                      Return Product
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
            <FaShoppingBasket className="text-green-200 dark:text-green-900 text-5xl mx-auto mb-4" />
            <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2">
              No Orders Found
            </h3>
            <p className="text-gray-500">Try changing filters or place a new order.</p>
          </div>
        )}
      </div>

      {returnModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl">
            <h3 className="text-lg font-black text-gray-900 mb-1">Return Product</h3>
            <p className="text-sm text-gray-600 mb-4">
              Order #{returnModalOrder.id.slice(-8).toUpperCase()}
            </p>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-2">
              Return Reason
            </label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={4}
              placeholder="Enter return reason"
              className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-amber-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={closeReturnModal}
                disabled={returnSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60"
              >
                Close
              </button>
              <button
                onClick={handleReturnSubmit}
                disabled={!String(returnReason || "").trim() || returnSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {returnSubmitting ? "Submitting..." : "Submit Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;

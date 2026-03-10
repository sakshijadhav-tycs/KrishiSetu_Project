"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import {
  FaBoxOpen,
  FaCalendarAlt,
  FaClipboardList,
  FaCreditCard,
  FaEnvelope,
  FaExclamationTriangle,
  FaHashtag,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaPhoneAlt,
  FaStore,
  FaTruck,
  FaUser,
} from "react-icons/fa";
import Loader from "../../components/Loader";
import OrderTimeline from "../../components/orders/OrderTimeline";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const OrderDetailsPage = () => {
  const { orderId } = useParams();
  const [orderDetail, setOrderDetail] = useState(null);
  const [splitOrderDetail, setSplitOrderDetail] = useState(null);
  const [splitDetailLoading, setSplitDetailLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(true);
  const [note, setNote] = useState("");
  const [flagReason, setFlagReason] = useState("");

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadSplitOrderDetail = useCallback(async (id) => {
    try {
      setSplitDetailLoading(true);
      const { data } = await axios.get(`${API_URL}/transparent-orders/${id}`, tokenHeader());
      setSplitOrderDetail(data?.data || null);
    } catch {
      setSplitOrderDetail(null);
    } finally {
      setSplitDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderDetail = async () => {
      try {
        setDetailLoading(true);
        const { data } = await axios.get(`${API_URL}/admin/orders/${orderId}`, tokenHeader());
        const detail = data?.data || null;
        setOrderDetail(detail);

        const inferredCategory = String(detail?.orderCategory || detail?.orderType || "").toLowerCase();
        if (inferredCategory === "split") {
          loadSplitOrderDetail(orderId);
        } else {
          setSplitOrderDetail(null);
        }
      } catch {
        setOrderDetail(null);
        setSplitOrderDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };

    fetchOrderDetail();
  }, [loadSplitOrderDetail, orderId]);

  const addNote = async () => {
    if (!orderId || !note.trim()) return;
    try {
      await axios.post(`${API_URL}/admin/orders/${orderId}/note`, { note }, tokenHeader());
      setNote("");
    } catch {
      // noop UI-only failure
    }
  };

  const flagOrder = async () => {
    if (!orderId || !flagReason.trim()) return;
    try {
      await axios.post(
        `${API_URL}/admin/orders/${orderId}/flag`,
        { reason: flagReason },
        tokenHeader()
      );
      setFlagReason("");
    } catch {
      // noop
    }
  };

  const renderPaymentBadge = (status) => {
    const s = (status || "").toLowerCase();
    let cls = "bg-gray-100 text-gray-700";
    if (s === "paid") cls = "bg-emerald-100 text-emerald-700";
    if (s === "unpaid") cls = "bg-amber-100 text-amber-700";
    if (s === "failed") cls = "bg-rose-100 text-rose-700";
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${cls}`}>
        {status}
      </span>
    );
  };

  const renderStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    let cls = "bg-gray-100 text-gray-700";
    if (["completed", "accepted", "delivered"].includes(s)) cls = "bg-emerald-100 text-emerald-700";
    else if (["processing", "shipped", "out_for_delivery"].includes(s)) cls = "bg-sky-100 text-sky-700";
    else if (s === "pending") cls = "bg-amber-100 text-amber-700";
    else if (s === "cancelled" || s === "rejected") cls = "bg-rose-100 text-rose-700";
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${cls}`}>
        {status}
      </span>
    );
  };

  const resolvedOrderCategory = String(orderDetail?.orderCategory || orderDetail?.orderType || "single").toLowerCase();
  const isSplitOrder = resolvedOrderCategory === "split";

  const farmerGroups = useMemo(() => {
    const groups = new Map();

    const ensureGroup = (key, name) => {
      const normalizedKey = String(key || name || "unknown");
      if (!groups.has(normalizedKey)) {
        groups.set(normalizedKey, {
          id: normalizedKey,
          name: String(name || "Unknown Farmer"),
          products: new Set(),
        });
      }
      return groups.get(normalizedKey);
    };

    if (isSplitOrder) {
      if (!splitOrderDetail) return [];

      (splitOrderDetail.subOrders || []).forEach((subOrder) => {
        const farmerRef = subOrder?.farmerId;
        const farmerId = farmerRef?._id || farmerRef;
        const farmerName = farmerRef?.name || "Unknown Farmer";
        ensureGroup(farmerId, farmerName);
      });

      (splitOrderDetail.items || []).forEach((item) => {
        const farmerId = item?.farmerId;
        const productName = item?.productName || "Product";
        const farmer = ensureGroup(farmerId, "Unknown Farmer");
        farmer.products.add(productName);
      });
    } else {
      (orderDetail?.items || []).forEach((item) => {
        const farmerRef = item?.farmer;
        const farmerId = farmerRef?._id || farmerRef || "unknown";
        const farmerName = farmerRef?.name || "Unknown Farmer";
        const productName = item?.product?.name || item?.name || "Product";
        const farmer = ensureGroup(farmerId, farmerName);
        farmer.products.add(productName);
      });
    }

    return Array.from(groups.values()).map((farmer) => ({
      id: farmer.id,
      name: farmer.name,
      products: Array.from(farmer.products),
    }));
  }, [isSplitOrder, orderDetail?.items, splitOrderDetail]);

  const displayItems = useMemo(() => {
    if (isSplitOrder && splitOrderDetail?.items?.length) {
      return splitOrderDetail.items.map((item) => ({
        _id: item?._id || `${item?.productId}-${item?.farmerId}`,
        productName: item?.productName || "Product",
        quantity: Number(item?.quantity || 0),
        price: Number(item?.price || 0),
      }));
    }

    return (orderDetail?.items || []).map((item) => ({
      _id: item?._id,
      productName: item?.product?.name || item?.name || "Product",
      quantity: Number(item?.quantity || 0),
      price: Number(item?.price || 0),
    }));
  }, [isSplitOrder, orderDetail?.items, splitOrderDetail]);

  const orderSummaryFields = useMemo(() => {
    if (!orderDetail) return [];

    return [
      {
        key: "id",
        label: "Order ID",
        value: `#${orderDetail._id?.slice(-8).toUpperCase() || "N/A"}`,
        icon: FaHashtag,
        tone: "bg-slate-100 text-slate-600",
      },
      {
        key: "date",
        label: "Order Date",
        value: orderDetail.createdAt
          ? new Date(orderDetail.createdAt).toLocaleString([], {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "N/A",
        icon: FaCalendarAlt,
        tone: "bg-blue-50 text-blue-600",
      },
      {
        key: "amount",
        label: "Total Amount",
        value: `\u20B9${Number(orderDetail.totalAmount || 0).toFixed(2)}`,
        icon: FaMoneyBillWave,
        tone: "bg-emerald-50 text-emerald-600",
      },
    ];
  }, [orderDetail]);

  const orderTypeMeta = useMemo(() => {
    const rawType = String(orderDetail?.orderCategory || orderDetail?.orderType || "delivery").toLowerCase();

    if (rawType === "pickup") {
      return { label: "Pickup", icon: FaStore, className: "bg-amber-100 text-amber-700" };
    }
    if (rawType === "online" || rawType === "online payment" || rawType === "razorpay") {
      return { label: "Online Payment", icon: FaCreditCard, className: "bg-sky-100 text-sky-700" };
    }
    if (rawType === "cod" || rawType === "cash on delivery") {
      return { label: "Cash on Delivery", icon: FaMoneyBillWave, className: "bg-orange-100 text-orange-700" };
    }
    if (rawType === "split" || rawType === "delivery") {
      return { label: "Delivery", icon: FaTruck, className: "bg-emerald-100 text-emerald-700" };
    }

    return {
      label: rawType.charAt(0).toUpperCase() + rawType.slice(1),
      icon: FaBoxOpen,
      className: "bg-emerald-100 text-emerald-700",
    };
  }, [orderDetail?.orderCategory, orderDetail?.orderType]);

  const OrderTypeIcon = orderTypeMeta.icon;
  const deliveryMethod = orderDetail?.deliveryMethod || orderTypeMeta.label;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Order Details</h1>
            <p className="mt-2 text-sm text-slate-500">
              Review fulfillment, customer details, products, and internal admin actions.
            </p>
          </div>
        </div>

        {detailLoading || !orderDetail || (isSplitOrder && splitDetailLoading && !splitOrderDetail) ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <Loader />
          </div>
        ) : (
          <>
            <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Order Summary
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-900">
                      {`#${orderDetail._id.slice(-8).toUpperCase()}`}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {renderPaymentBadge(orderDetail.paymentStatus)}
                    {renderStatusBadge(orderDetail.status)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                {orderSummaryFields.map((field) => {
                  const Icon = field.icon;
                  return (
                    <div
                      key={field.key}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${field.tone}`}>
                          <Icon className="text-sm" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {field.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{field.value}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <FaCreditCard className="text-sm" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Payment Status
                      </p>
                      <div className="mt-2">{renderPaymentBadge(orderDetail.paymentStatus)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <FaTruck className="text-sm" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Order Status
                      </p>
                      <div className="mt-2">{renderStatusBadge(orderDetail.status)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                    Order Tracking
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">Shipment progress and fulfillment status</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {orderDetail.trackingId || "No tracking ID"}
                </span>
              </div>
              <OrderTimeline
                status={orderDetail.status}
                expectedDeliveryDate={orderDetail.expectedDeliveryDate}
                createdAt={orderDetail.createdAt}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1fr]">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <FaUser className="text-emerald-600 text-sm" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                      Customer Information
                    </h3>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-base font-semibold text-slate-900">
                      {orderDetail.consumer?.name || "Unknown Customer"}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <FaEnvelope className="text-[11px]" />
                      {orderDetail.consumer?.email || "No email"}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <FaPhoneAlt className="text-[11px]" />
                      {orderDetail.consumer?.phone || "No phone"}
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <FaMapMarkerAlt className="text-emerald-600 text-sm" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                      Delivery Details
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Expected Delivery
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {orderDetail.expectedDeliveryDate
                          ? new Date(orderDetail.expectedDeliveryDate).toLocaleDateString([], {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Tracking ID
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {orderDetail.trackingId || "N/A"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Delivery Method
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{deliveryMethod}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <FaStore className="text-amber-600 text-sm" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                      Farmer Information
                    </h3>
                  </div>
                  {farmerGroups.length > 0 ? (
                    <div className="space-y-3">
                      {farmerGroups.map((farmer) => (
                        <div
                          key={farmer.id}
                          className="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-4"
                        >
                          <p className="text-sm font-semibold text-slate-900">{farmer.name}</p>
                          <p className="mt-2 text-sm text-slate-600">
                            Product supplied: {farmer.products.length > 0 ? farmer.products.join(", ") : "N/A"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Farmer mapping not available for this order.</p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <FaTruck className="text-sky-600 text-sm" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                      Order Type
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${orderTypeMeta.className}`}
                  >
                    <OrderTypeIcon className="text-sm" />
                    {orderTypeMeta.label}
                  </span>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <FaBoxOpen className="text-violet-600 text-sm" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                      Products
                    </h3>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Quantity</th>
                            <th className="px-4 py-3 text-right">Unit Price</th>
                            <th className="px-4 py-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {displayItems.map((item) => (
                            <tr key={item._id}>
                              <td className="px-4 py-3 font-semibold text-slate-900">{item.productName}</td>
                              <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-slate-600">
                                &#8377;{item.price.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                &#8377;{(item.quantity * item.price).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <FaClipboardList className="text-slate-600 text-sm" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                      Internal Admin Notes
                    </h3>
                  </div>
                  <p className="mb-4 text-xs text-slate-400">
                    <span className="font-semibold">Info:</span> These notes are internal and visible only to admins.
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                        <FaClipboardList className="text-[11px]" />
                        Add Internal Note
                      </label>
                      <textarea
                        rows={5}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded-2xl border border-emerald-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                        placeholder="Add an internal note about this order..."
                      />
                      <button
                        onClick={addNote}
                        className="mt-3 inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        Save Note
                      </button>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                      <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">
                        <FaExclamationTriangle className="text-[11px]" />
                        Flag Order
                      </label>
                      <textarea
                        rows={5}
                        value={flagReason}
                        onChange={(e) => setFlagReason(e.target.value)}
                        className="w-full rounded-2xl border border-rose-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-rose-400"
                        placeholder="Reason for flagging this order..."
                      />
                      <button
                        onClick={flagOrder}
                        className="mt-3 inline-flex items-center rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
                      >
                        Flag as Suspicious
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderDetailsPage;

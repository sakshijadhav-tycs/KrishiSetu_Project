"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaShoppingBasket } from "react-icons/fa";
import Loader from "../../components/Loader";
import OrderTimeline from "../../components/orders/OrderTimeline";
import {
  cancelOrderByFarmer,
  getFarmerOrders,
  getFarmerTransparentSubOrders,
  reviewFarmerTransparentReturnRequest,
  updateFarmerTransparentSubOrderStatus,
  updateOrderStatus,
} from "../../redux/slices/orderSlice";

const STATUS_STEPS = ["pending", "accepted", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"];
const UNIFIED_NEXT = {
  pending: ["accepted"],
  accepted: ["processing"],
  processing: ["shipped"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  rejected: [],
  delivered: [],
  cancelled: [],
};

const SEQUENTIAL_NEXT = {
  pending: ["accepted"],
  accepted: ["processing"],
  processing: ["shipped"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

const normalizeSubStatus = (s = "") => String(s).toLowerCase().replace(/\s+/g, "_");
const denormalizeSubStatus = (s = "") => {
  const m = {
    pending: "Pending",
    accepted: "Accepted",
    processing: "Processing",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return m[s] || "Pending";
};

const OrdersPage = () => {
  const dispatch = useDispatch();
  const { farmerOrders, farmerTransparentSubOrders, loading } = useSelector((state) => state.orders);
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [rowDraftStatus, setRowDraftStatus] = useState({});
  const [updatingRowKey, setUpdatingRowKey] = useState("");
  const [cancelModalRow, setCancelModalRow] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [returnActionRowId, setReturnActionRowId] = useState("");

  useEffect(() => {
    dispatch(getFarmerOrders({ category, paymentMethod }));
    if (category === "all" || category === "split") {
      dispatch(getFarmerTransparentSubOrders({ paymentMethod }));
    }
  }, [dispatch, category, paymentMethod]);

  const mergedRows = useMemo(() => {
    const regular = (farmerOrders || []).map((row) => ({
      id: row._id,
      createdAt: row.createdAt,
      status: normalizeSubStatus(row.status === "completed" ? "delivered" : row.status || "pending"),
      subtotal: Number(row.totalAmount || 0),
      commissionAmount: Number(row.commissionAmount || ((Number(row.totalAmount || 0) * Number(row.commissionPercentApplied || 10)) / 100)),
      payoutAmount: Number(row.payoutAmount || (Number(row.totalAmount || 0) - Number(row.commissionAmount || ((Number(row.totalAmount || 0) * Number(row.commissionPercentApplied || 10)) / 100)))),
      payoutStatus: row.payoutStatus ?? "Not Initialized",
      source: "regular",
      raw: row,
      label: row.isSubscriptionOrder ? "Subscription Order" : "Single Vendor Order",
      trackingId: row.trackingId || "",
      expectedDeliveryDate: row.expectedDeliveryDate || null,
    }));
    const split = (farmerTransparentSubOrders || []).map((row) => ({
      id: row._id,
      createdAt: row.createdAt,
      status: normalizeSubStatus(row.fulfillmentStatus || "Pending"),
      subtotal: Number(row.subtotal || 0),
      commissionAmount: Number(row.commissionAmount || 0),
      payoutAmount: Number(row.payoutAmount || 0),
      payoutStatus: row.payoutStatus ?? "Not Initialized",
      source: "transparent",
      raw: row,
      label:
        Number(row?.mainOrderSubOrderCount || 0) === 1 ||
        String(row?.orderId?.orderType || "").toLowerCase() === "single"
          ? "Single Vendor Order"
          : "Split Sub-order",
      trackingId: row.trackingId || "",
      expectedDeliveryDate: row.expectedDeliveryDate || null,
    }));
    const includeSplit = category === "all" || category === "split";
    const merged = includeSplit ? [...regular, ...split] : [...regular];
    return merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [farmerOrders, farmerTransparentSubOrders, category]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return mergedRows;
    return mergedRows.filter((row) => row.status === filter);
  }, [mergedRows, filter]);
  const pendingReturnRows = useMemo(
    () =>
      mergedRows.filter(
        (row) =>
          row.source === "transparent" &&
          String(row.raw?.returnRequest?.status || "") === "Pending"
      ),
    [mergedRows]
  );

  const getRowKey = (row) => `${row.source}-${row.id}`;
  const getStatusLabel = (status) => String(status || "").replaceAll("_", " ");

  const handleStatusUpdate = async (row, status) => {
    if (status === "cancelled") {
      openCancelModal(row);
      return;
    }
    const rowKey = getRowKey(row);
    setUpdatingRowKey(rowKey);
    if (row.source === "transparent") {
      await dispatch(
        updateFarmerTransparentSubOrderStatus({
          id: row.id,
          status: denormalizeSubStatus(status),
        })
      );
      dispatch(getFarmerTransparentSubOrders({ paymentMethod }));
      setUpdatingRowKey("");
      return;
    }
    await dispatch(updateOrderStatus({ id: row.id, status }));
    dispatch(getFarmerOrders({ category, paymentMethod }));
    setUpdatingRowKey("");
  };

  const openCancelModal = (row) => {
    setCancelModalRow(row);
    setCancelReason("");
  };

  const closeCancelModal = () => {
    if (cancelling) return;
    setCancelModalRow(null);
    setCancelReason("");
  };

  const confirmCancelByFarmer = async () => {
    const reason = String(cancelReason || "").trim();
    if (!cancelModalRow || !reason || cancelling) return;
    const confirmed = window.confirm("Are you sure you want to cancel this order?");
    if (!confirmed) return;
    setCancelling(true);
    const result =
      cancelModalRow.source === "transparent"
        ? await dispatch(
            updateFarmerTransparentSubOrderStatus({
              id: cancelModalRow.id,
              status: "Cancelled",
              reason,
            })
          )
        : await dispatch(cancelOrderByFarmer({ id: cancelModalRow.id, reason }));
    setCancelling(false);
    const isSuccess =
      cancelModalRow.source === "transparent"
        ? updateFarmerTransparentSubOrderStatus.fulfilled.match(result)
        : cancelOrderByFarmer.fulfilled.match(result);
    if (!isSuccess) {
      return;
    }
    setCancelModalRow(null);
    setCancelReason("");
    if (cancelModalRow.source === "transparent") {
      dispatch(getFarmerTransparentSubOrders({ paymentMethod }));
    } else {
      dispatch(getFarmerOrders({ category, paymentMethod }));
    }
  };

  const handleReturnDecision = async (row, decision) => {
    setReturnActionRowId(row.id);
    const result = await dispatch(
      reviewFarmerTransparentReturnRequest({ id: row.id, decision })
    );
    setReturnActionRowId("");
    if (!reviewFarmerTransparentReturnRequest.fulfilled.match(result)) {
      return;
    }
    dispatch(getFarmerTransparentSubOrders({ paymentMethod }));
  };

  if (loading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold dark:text-gray-100">Farmer Order Control</h1>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { id: "all", label: "All Categories" },
          { id: "split", label: "Split Sub Orders" },
          { id: "single", label: "Single Vendor Orders" },
          { id: "subscription", label: "Subscription Orders" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider ${
              category === tab.id
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            } transition-colors`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {["all", "razorpay", "cod"].map((tab) => (
          <button
            key={tab}
            onClick={() => setPaymentMethod(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider ${
              paymentMethod === tab
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            } transition-colors`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {["all", ...STATUS_STEPS].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg ${
              filter === tab
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            } transition-colors`}
          >
            {tab}
          </button>
        ))}
      </div>

      {pendingReturnRows.length > 0 && (
        <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Return Requests
            </h2>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">
              {pendingReturnRows.length} Pending
            </span>
          </div>
          <div className="space-y-3">
            {pendingReturnRows.map((row) => (
              <div
                key={`return-${row.id}`}
                className="rounded-2xl border border-amber-100 bg-amber-50 p-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-amber-600 font-black">
                      Return Request
                    </p>
                    <h3 className="font-black text-gray-900">
                      #{row.id.slice(-8).toUpperCase()}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Requested:{" "}
                      {row.raw?.returnRequest?.requestedAt
                        ? new Date(row.raw.returnRequest.requestedAt).toLocaleString()
                        : "N/A"}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                      Reason:{" "}
                      <span className="font-semibold">
                        {row.raw?.returnRequest?.reason || "No reason provided"}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReturnDecision(row, "approved")}
                      disabled={returnActionRowId === row.id}
                      className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {returnActionRowId === row.id ? "Updating..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReturnDecision(row, "rejected")}
                      disabled={returnActionRowId === row.id}
                      className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredRows.length > 0 ? (
        <div className="space-y-4">
          {filteredRows.map((row) => {
            const next =
              row.source === "transparent" && row.status === "pending"
                ? ["accepted", "cancelled"]
                : SEQUENTIAL_NEXT[row.status] ||
                  (row.source === "transparent"
                    ? []
                    : UNIFIED_NEXT[row.status] || []);
            const rowKey = getRowKey(row);
            const selectedStatus = rowDraftStatus[rowKey] || next[0] || "";
            return (
              <div
                key={`${row.source}-${row.id}`}
                className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Order ID</p>
                    <h3 className="font-black text-gray-900 dark:text-gray-100">#{row.id.slice(-8).toUpperCase()}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs mt-2 px-2 py-1 inline-block rounded bg-blue-50 text-blue-700 border border-blue-100 font-bold">
                      {row.label}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-black">Subtotal</p>
                      <p className="font-black text-gray-900 dark:text-gray-100">Rs {row.subtotal.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-black">Commission</p>
                      <p className="font-black text-red-600">Rs {row.commissionAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-black">Payout</p>
                      <p className="font-black text-green-700 dark:text-green-400">Rs {row.payoutAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-black">Settlement</p>
                      <p className="font-black">{row.payoutStatus}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-sm text-gray-500 mb-3">
                    Status:{" "}
                    <span className="font-black uppercase">
                      {getStatusLabel(row.status)}
                    </span>
                  </div>
                  {row.source === "transparent" &&
                    String(row.raw?.returnRequest?.status || "None") !== "None" && (
                      <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                        <span className="font-black uppercase tracking-wider">Return Status:</span>{" "}
                        {row.raw?.returnRequest?.status}
                      </div>
                    )}
                  <OrderTimeline
                    status={row.status}
                    expectedDeliveryDate={row.expectedDeliveryDate}
                    trackingId={row.trackingId}
                    className="mb-3"
                  />
                  {next.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedStatus}
                        onChange={(e) =>
                          setRowDraftStatus((prev) => ({
                            ...prev,
                            [rowKey]: e.target.value,
                          }))
                        }
                        className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-black uppercase tracking-wider bg-white"
                      >
                        {next.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!selectedStatus || updatingRowKey === rowKey}
                        onClick={() => handleStatusUpdate(row, selectedStatus)}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-60 ${
                          selectedStatus === "cancelled" || selectedStatus === "rejected"
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                      >
                        {updatingRowKey === rowKey ? "Updating..." : "Update Status"}
                      </button>
                      {row.source === "regular" &&
                        ["pending", "accepted"].includes(row.status) && (
                          <button
                            onClick={() => openCancelModal(row)}
                            className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-700"
                          >
                            Cancel Order
                          </button>
                        )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No further actions available.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <FaShoppingBasket className="text-green-500 text-5xl mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">No Orders Found</h3>
          <p className="text-gray-600 dark:text-gray-300">Try a different filter.</p>
        </div>
      )}

      {cancelModalRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl">
            <h3 className="text-lg font-black text-gray-900 mb-1">Cancel Order</h3>
            <p className="text-sm text-gray-600 mb-4">
              Order #{cancelModalRow.id.slice(-8).toUpperCase()}
            </p>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-2">
              Cancellation Reason
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
              placeholder="Enter reason (e.g. Product out of stock)"
              className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-red-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={closeCancelModal}
                disabled={cancelling}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60"
              >
                Close
              </button>
              <button
                onClick={confirmCancelByFarmer}
                disabled={!String(cancelReason || "").trim() || cancelling}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;

import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FaDownload, FaFileInvoice, FaReceipt } from "react-icons/fa";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../components/Loader";
import {
  getOrderDetails,
  getTransparentOrderDetails,
  requestTransparentOrderReturn,
} from "../redux/slices/orderSlice";
import OrderTimeline from "../components/orders/OrderTimeline";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const OrderDetailPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const transparent = searchParams.get("transparent") === "1";
  const { order, transparentOrderDetails, loading, error } = useSelector((state) => state.orders);
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  useEffect(() => {
    if (transparent) {
      dispatch(getTransparentOrderDetails(id));
      return;
    }
    dispatch(getOrderDetails(id));
  }, [dispatch, id, transparent]);

  const detail = useMemo(() => {
    if (!transparent) return null;
    const data = transparentOrderDetails || {};
    const mainOrder = data.mainOrder;
    if (!mainOrder) return null;

    const subOrders = data.subOrders || [];
    const items = data.items || [];
    const farmerNames = [
      ...new Set(
        subOrders
          .map((s) => s?.farmerId?.name)
          .filter(Boolean)
      ),
    ];
    const normalizedStatus = String(mainOrder.orderStatus || "processing").toLowerCase();
    const cancelledSubOrder = subOrders.find(
      (s) => String(s?.fulfillmentStatus || "").toLowerCase() === "cancelled"
    );
    return {
      id: mainOrder._id,
      createdAt: mainOrder.createdAt,
      items,
      farmerNames,
      productSubtotal: Number(mainOrder.productSubtotal || 0),
      gstAmount: Number(mainOrder.gstAmount || 0),
      deliveryCharge: Number(mainOrder.deliveryCharge || 0),
      totalAmount: Number(mainOrder.totalAmount || 0),
      paymentMethod: mainOrder.paymentMethod || "razorpay",
      paymentStatus: mainOrder.paymentStatus || "pending",
      status: normalizedStatus === "created" ? "pending" : normalizedStatus,
      type: "split",
      isSubscriptionOrder:
        mainOrder.orderType === "subscription" || mainOrder.purchaseMode === "Subscription",
      expectedDeliveryDate: mainOrder.expectedDeliveryDate || null,
      trackingId: mainOrder.trackingId || "",
      cancellationReason: cancelledSubOrder?.cancellationReason || "",
      returnSummary: data.returnSummary || {
        hasEligibleReturn: false,
        hasPendingReturn: false,
        hasApprovedReturn: false,
        statuses: [],
      },
      subOrders,
    };
  }, [transparent, transparentOrderDetails]);

  const regularDetail = useMemo(() => {
    if (transparent || !order) return null;
    const farmerNames = [
      ...new Set((order.items || []).map((item) => item?.farmer?.name).filter(Boolean)),
    ];
    const normalizedStatus = String(order.status === "completed" ? "delivered" : order.status || "pending").toLowerCase();
    return {
      id: order._id,
      createdAt: order.createdAt,
      items: order.items || [],
      farmerNames,
      productSubtotal: Number(order.totalAmount || 0),
      gstAmount: 0,
      deliveryCharge: 0,
      totalAmount: Number(order.totalAmount || 0),
      paymentMethod: order.paymentMethod || "cod",
      paymentStatus: order.paymentStatus || "pending",
      status: normalizedStatus,
      type: "regular",
      statusTimeline: order.statusTimeline || [],
      isSubscriptionOrder: Boolean(order.isSubscriptionOrder),
      expectedDeliveryDate: order.expectedDeliveryDate || null,
      trackingId: order.trackingId || "",
      cancellationReason: order.cancellationReason || "",
      returnSummary: null,
      subOrders: [],
    };
  }, [transparent, order]);

  const view = transparent ? detail : regularDetail;

  const downloadInvoice = async () => {
    try {
      if (!view) return;
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        return;
      }
      const endpoint = view.type === "split"
        ? `/transparent-orders/${view.id}/invoice`
        : (
          String(view.paymentStatus).toLowerCase() === "paid"
            ? `/orders/${view.id}/receipt`
            : `/orders/${view.id}/invoice`
        );
      const response = await axios.get(`${API_URL}${endpoint}`, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement("a");
      anchor.href = url;
      const label = view.type === "split"
        ? "invoice-transparent"
        : (view.paymentStatus === "paid" ? "receipt" : "invoice");
      anchor.download = `${label}-${view.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download invoice");
    }
  };

  const handleReturnRequest = async () => {
    const reason = String(returnReason || "").trim();
    if (!transparent || !view?.returnSummary?.hasEligibleReturn || !reason) {
      return;
    }
    setReturnSubmitting(true);
    const result = await dispatch(
      requestTransparentOrderReturn({ id: view.id, reason })
    );
    setReturnSubmitting(false);
    if (!requestTransparentOrderReturn.fulfilled.match(result)) {
      return;
    }
    setReturnReason("");
    dispatch(getTransparentOrderDetails(id));
  };

  if (loading) return <Loader />;
  if (!view) {
    const message =
      String(error || "").toLowerCase().includes("unauthorized")
        ? "Please login with the account that placed this order."
        : error || "Order not found.";

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">{message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 sticky top-0 z-10">
        <div className="container mx-auto max-w-5xl flex items-center justify-between">
          <div className="w-8" />
          <h1 className="text-lg font-black uppercase tracking-widest text-gray-800 dark:text-gray-100">
            Order Details
          </h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-200">
              <FaReceipt />
              <h2 className="font-black uppercase tracking-wider">
                Order #{view.id.slice(-8).toUpperCase()}
              </h2>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              Placed on {new Date(view.createdAt).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mb-1">
              Farmers: <span className="font-semibold">{view.farmerNames.length ? view.farmerNames.join(", ") : "N/A"}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Payment: <span className="font-semibold">{view.paymentMethod}</span> | Status:{" "}
              <span className="font-semibold">{view.paymentStatus}</span>
            </p>

            {view.isSubscriptionOrder && (
              <div className="mb-4 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-xs font-black uppercase tracking-widest inline-block">
                Subscription Order
              </div>
            )}

            <div className="space-y-3">
              {view.items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700"
                >
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-100">
                      {item.productName || item.product?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty {item.quantity} x Rs {Number(item.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <p className="font-black text-green-700 dark:text-green-400">
                    Rs {Number(item.total || Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-black uppercase tracking-wider text-gray-800 dark:text-gray-100 mb-4">
              Order Status Timeline
            </h3>
            <OrderTimeline
              status={view.status}
              expectedDeliveryDate={view.expectedDeliveryDate}
              trackingId={view.trackingId}
            />
            {transparent && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-700">
                  <span className="font-black">Return Status:</span>{" "}
                  {view.returnSummary?.hasPendingReturn
                    ? "Pending"
                    : view.returnSummary?.hasApprovedReturn
                      ? "Approved"
                      : view.returnSummary?.statuses?.some((item) => item.returnRequest?.status === "Rejected")
                        ? "Rejected"
                        : "None"}
                </div>
                {view.subOrders?.map((subOrder) => (
                  (() => {
                    const delivered =
                      String(subOrder?.fulfillmentStatus || "").toLowerCase() === "delivered";
                    const hasReturnActivity =
                      String(subOrder?.returnRequest?.status || "None") !== "None";

                    return (
                      <div
                        key={subOrder._id}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700"
                      >
                        <p className="font-black text-gray-800">
                          Farmer: {subOrder?.farmerId?.name || "Unknown Farmer"}
                        </p>
                        <p className="text-xs mt-1">
                          Return: {subOrder?.returnRequest?.status || "None"}
                        </p>
                        {delivered && subOrder?.returnWindowEndsAt && (
                          <p className="text-xs mt-1">
                            Return Window Ends: {new Date(subOrder.returnWindowEndsAt).toLocaleString()}
                          </p>
                        )}
                        {!delivered && !hasReturnActivity && (
                          <p className="text-xs mt-1 text-gray-500">
                            Return option will appear after delivery.
                          </p>
                        )}
                      </div>
                    );
                  })()
                ))}
              </div>
            )}
            {String(view.status || "").includes("cancelled") && view.cancellationReason && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                <span className="font-black">Cancellation Reason:</span> {view.cancellationReason}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FaFileInvoice className="text-green-600" />
              <h3 className="font-black uppercase tracking-wider text-gray-800 dark:text-gray-100">
                Invoice Summary
              </h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Product Subtotal</span>
                <span className="font-bold">Rs {view.productSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GST</span>
                <span className="font-bold">Rs {view.gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Charge</span>
                <span className="font-bold">Rs {view.deliveryCharge.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-dashed border-gray-200 dark:border-gray-600 flex justify-between">
                <span className="font-black uppercase">Total Amount</span>
                <span className="font-black text-green-700 dark:text-green-400">
                  Rs {view.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-gray-100 dark:border-gray-700 space-y-3">
              {transparent && view.returnSummary?.hasEligibleReturn && (
                <>
                  <textarea
                    rows={3}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Enter return reason"
                    className="w-full px-3 py-2 rounded-xl border border-amber-100 text-xs"
                  />
                  <button
                    onClick={handleReturnRequest}
                    disabled={!String(returnReason || "").trim() || returnSubmitting}
                    className="w-full inline-flex justify-center items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-700 transition disabled:opacity-60"
                  >
                    {returnSubmitting ? "Submitting..." : "Return Product"}
                  </button>
                </>
              )}
              <Link
                to={`/orders/${view.id}${transparent ? "?transparent=1" : ""}`}
                className="w-full inline-flex justify-center items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition"
              >
                View Invoice
              </Link>
              <button
                onClick={downloadInvoice}
                className="w-full inline-flex justify-center items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition"
              >
                <FaDownload />
                Download Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;

import { FaBoxOpen, FaCheckCircle, FaClipboardCheck, FaTruck } from "react-icons/fa";

const STEPS = [
  { id: "pending", label: "Order Confirmed", icon: FaClipboardCheck },
  { id: "processing", label: "Processing", icon: FaBoxOpen },
  { id: "shipped", label: "Shipped", icon: FaTruck },
  { id: "out_for_delivery", label: "Out for Delivery", icon: FaTruck },
  { id: "delivered", label: "Delivered", icon: FaCheckCircle },
];

const normalize = (status = "") => {
  const s = String(status || "").toLowerCase();
  if (s === "accepted") return "pending";
  if (s === "completed") return "delivered";
  if (s === "out for delivery") return "out_for_delivery";
  if (s === "cancelled_by_farmer") return "cancelled";
  return s;
};

const statusIndex = (status = "") => {
  const s = normalize(status);
  if (s === "cancelled" || s === "rejected") return -1;
  const idx = STEPS.findIndex((step) => step.id === s);
  return idx >= 0 ? idx : 0;
};

const OrderTimeline = ({
  status,
  expectedDeliveryDate,
  createdAt,
  className = "",
}) => {
  const currentIndex = statusIndex(status);
  const progress = currentIndex <= 0 ? 0 : (currentIndex / (STEPS.length - 1)) * 100;
  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Pending";
  const deliveryLabel = expectedDeliveryDate
    ? new Date(expectedDeliveryDate).toLocaleDateString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Pending";

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-5 ${className}`}>
      <div className="relative mb-2">
        <div className="absolute left-5 right-5 top-5 h-1 rounded-full bg-slate-200" />
        <div
          className="absolute left-5 top-5 h-1 rounded-full bg-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `calc(${progress}% - 10px)` }}
        />
        <div className="relative grid grid-cols-5 gap-2">
          {STEPS.map((step, idx) => {
            const done = currentIndex >= idx;
            const current = currentIndex === idx;
            const Icon = step.icon;
            const metaLabel =
              idx === 0
                ? createdLabel
                : idx === STEPS.length - 1 && done
                  ? deliveryLabel
                  : done
                    ? "Completed"
                    : current
                      ? "In progress"
                      : "Pending";

            return (
              <div key={step.id} className="text-center">
                <div
                  className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border ${
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                      : current
                        ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  <Icon className="text-sm" />
                </div>
                <p
                  className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
                    done || current ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">{metaLabel}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderTimeline;

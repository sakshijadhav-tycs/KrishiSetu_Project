import { Link } from "react-router-dom";
import { FaEye, FaCalendarAlt, FaBoxOpen, FaUser } from "react-icons/fa";
const OrderItem = ({ order }) => {
  // 🎨 Function to get dynamic modern status colors
  const getStatusStyles = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "bg-orange-50 text-orange-600 border-orange-100";
      case "accepted":
        return "bg-blue-50 text-blue-600 border-blue-100";
      case "completed":
      case "delivered":
        return "bg-green-50 text-green-600 border-green-100";
      case "rejected":
      case "cancelled":
        return "bg-red-50 text-red-600 border-red-100";
      default:
        return "bg-gray-50 text-gray-600 border-gray-100";
    }
  };

  // 📅 Format date logic
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 mb-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* 🆔 Order ID & Date Section */}
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
              <FaBoxOpen size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {t("orders.orderIdLabel")}
              </p>
              <p className="font-black text-gray-800">#{order?._id?.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <FaCalendarAlt className="text-gray-300" size={14} />
            <span className="text-sm font-bold text-gray-500">{formatDate(order?.createdAt)}</span>
          </div>
        </div>

        {/* 💰 Summary Section */}
        <div className="flex-1 border-l border-gray-50 pl-6 hidden md:block">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            {t("orders.itemsSummary")}
          </p>
          <p className="text-sm font-bold text-gray-600 mb-2">
            {t("orders.productsOrdered", { count: order?.items?.length || 0 })}
          </p>
          <p className="text-xl font-black text-green-600">
            ₨{order?.totalAmount?.toFixed(2) || "0.00"}
          </p>
        </div>

        {/* 👤 Status & Stakeholder Section */}
        <div className="flex-1 lg:text-right">
          <div className={`inline-block px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tighter mb-3 ${getStatusStyles(order?.status)}`}>
            {order?.status || t("orders.statusProcessing")}
          </div>
          <div className="flex items-center lg:justify-end space-x-2 text-gray-500">
            <FaUser size={12} />
            <span className="text-xs font-bold uppercase tracking-tight">
              {t("orders.buyerLabel", {
                name: order?.consumer?.name || "Customer",
              })}
            </span>
          </div>
        </div>

        {/* 🔗 Action Button */}
        <div className="lg:pl-6 border-t lg:border-t-0 pt-4 lg:pt-0">
          <Link
            to={`/orders/${order?._id}`}
            className="w-full lg:w-auto bg-gray-900 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center space-x-3 hover:bg-green-600 transition-colors shadow-lg active:scale-95"
          >
            <FaEye />
            <span>{t("orders.details")}</span>
          </Link>
        </div>

      </div>
    </div>
  );
};

export default OrderItem;
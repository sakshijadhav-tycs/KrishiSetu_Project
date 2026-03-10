import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import AdminTable from "../../components/admin/AdminTable";
import StatusBadge from "../../components/admin/StatusBadge";
import { BACKEND_URL } from "../../config/api";
import { resolveImageUrl } from "../../utils/imageUrl";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const CustomerManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/admin/customers`, tokenHeader());
      setCustomers(data?.data || []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleBlockToggle = async (customer) => {
    const nextBlocked = !customer.isBlocked;
    try {
      await axios.patch(
        `${API_URL}/admin/customers/${customer._id}/status`,
        { isBlocked: nextBlocked, reason: nextBlocked ? "Blocked by admin" : "" },
        tokenHeader()
      );
      loadCustomers();
    } catch {
      // noop
    }
  };

  const openOrderHistory = async (customer) => {
    try {
      setSelectedCustomer(customer);
      setHistoryLoading(true);
      const { data } = await axios.get(
        `${API_URL}/admin/customers/${customer._id}/orders`,
        tokenHeader()
      );
      setOrderHistory(data?.data?.orders || []);
    } catch {
      setOrderHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const rows = useMemo(() => customers, [customers]);

  const columns = [
    {
      key: "profileImage",
      label: "Profile Image",
      render: (row) => {
        const src = resolveImageUrl(row?.profileImage, BACKEND_URL) || "/logo.png";
        return (
          <img
            src={src}
            alt={row?.name || "Customer"}
            className="w-9 h-9 rounded-full object-cover border border-green-100"
          />
        );
      },
    },
    {
      key: "name",
      label: "Customer Name",
      render: (row) => <span className="font-semibold text-gray-900">{row?.name || "-"}</span>,
    },
    {
      key: "email",
      label: "Email",
      render: (row) => row?.email || "-",
    },
    {
      key: "phone",
      label: "Phone Number",
      render: (row) => row?.phone || "-",
    },
    {
      key: "createdAt",
      label: "Registration Date",
      render: (row) => (row?.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"),
    },
    {
      key: "totalOrders",
      label: "Total Orders",
      align: "center",
      render: (row) => row?.totalOrders || 0,
    },
    {
      key: "accountStatus",
      label: "Account Status",
      render: (row) => <StatusBadge status={row?.accountStatus || "Active"} />,
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => openOrderHistory(row)}
            className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-[11px] font-bold hover:bg-blue-100"
          >
            Order History
          </button>
          <button
            onClick={() => handleBlockToggle(row)}
            className={`px-3 py-1 rounded-xl text-[11px] font-bold ${
              row?.isBlocked
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            {row?.isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Customer Management</h1>
        <p className="text-sm text-gray-500 mt-1">View customer profiles, status, and order history.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-green-100 p-8 text-sm text-gray-500">
          Loading customers...
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row._id}
          emptyMessage="No customers found."
        />
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl border border-green-100 shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {selectedCustomer.name} - Order History
                </h3>
                <p className="text-xs text-gray-500">{selectedCustomer.email}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setOrderHistory([]);
                }}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {historyLoading ? (
                <p className="text-sm text-gray-500">Loading order history...</p>
              ) : orderHistory.length === 0 ? (
                <p className="text-sm text-gray-500">No orders found for this customer.</p>
              ) : (
                <div className="space-y-3">
                  {orderHistory.map((order) => (
                    <div key={order._id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">
                          Order ID: {String(order._id).toUpperCase()}
                        </p>
                        <StatusBadge status={order.status || "pending"} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Date: {new Date(order.createdAt).toLocaleDateString()} | Amount: Rs{" "}
                        {Number(order.totalAmount || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagementPage;

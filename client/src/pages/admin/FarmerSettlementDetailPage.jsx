"use client";

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Loader from "../../components/Loader";
import AdminCard from "../../components/admin/AdminCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const FarmerSettlementDetailPage = () => {
  const { farmerId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_URL}/admin/settlements/farmer/${farmerId}`,
        tokenHeader()
      );
      setData(res.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmerId]);

  const renderStatusBadge = (status = "") => {
    const s = String(status || "").toLowerCase();
    let cls = "bg-gray-100 text-gray-700";
    if (s === "transferred") cls = "bg-green-100 text-green-700";
    else if (s === "eligible") cls = "bg-sky-100 text-sky-700";
    else if (s === "pending") cls = "bg-yellow-100 text-yellow-700";
    else if (s === "onhold") cls = "bg-red-100 text-red-700";
    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${cls}`}>
        {status || "-"}
      </span>
    );
  };

  if (loading) return <Loader />;

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-green-100 p-6 shadow-sm text-sm text-gray-500">
        Unable to load farmer settlement details.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Farmer Settlement Detail</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data?.farmer?.name || "Unknown Farmer"} ({data?.farmer?._id || "-"})
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard
          title="Total Earnings"
          value={`Rs ${Number(data?.totals?.totalEarnings || 0).toFixed(2)}`}
          subtitle="All settlement records"
        />
        <AdminCard
          title="Total Transferred"
          value={`Rs ${Number(data?.totals?.totalTransferred || 0).toFixed(2)}`}
          subtitle="Successfully paid"
          accent="sky"
        />
        <AdminCard
          title="Pending Amount"
          value={`Rs ${Number(data?.totals?.pendingAmount || 0).toFixed(2)}`}
          subtitle="Pending + eligible"
          accent="orange"
        />
      </div>

      <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-black uppercase tracking-[0.15em] text-gray-500">
            Settlement Timeline
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-green-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                  Orders Included
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                  Trigger
                </th>
              </tr>
            </thead>
            <tbody>
              {(data?.timeline || []).map((row) => (
                <tr key={`${row.settlementType}-${row.rowId}`} className="border-t border-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {row.transferDate ? new Date(row.transferDate).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-mono">
                    {row.orderOrSubOrderId || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-right font-semibold text-gray-800">
                    Rs {Number(row.amountTransferred || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-center">
                    {renderStatusBadge(row.payoutStatus)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{row.settlementType}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 capitalize">
                    {row.settlementTrigger || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FarmerSettlementDetailPage;

//“use client”;

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  getFarmerOrders,
  getFarmerTransparentSubOrders,
} from "../../redux/slices/orderSlice";
import { getFarmerProducts } from "../../redux/slices/productSlice";
import { FaBox, FaShoppingCart, FaComments, FaChartLine, FaPlus, FaExclamationTriangle, FaEdit, FaCalendarCheck, FaBell, FaTags } from "react-icons/fa";
import Loader from "../../components/Loader";
import Joyride from "react-joyride";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ImportantAnnouncementBanner from "../../components/ImportantAnnouncementBanner";
import { API_URL, BACKEND_URL } from "../../config/api";


// StatCard Component
const StatCard = ({ icon, label, value, link, color, dataAttr, t }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all transform hover:-translate-y-1" data-tour={dataAttr}>
    <div className="flex items-center gap-4">
      <div className={`${color} p-4 rounded-2xl text-2xl`}>{icon}</div>
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">{label}</p>
        <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">{value}</h3>
      </div>
    </div>
    {link && (
      <Link to={link} className="text-green-600 dark:text-green-400 text-xs font-bold mt-5 flex items-center gap-1 hover:gap-2 transition-all">
        {t("farmerDashboard.viewAll")} <span className="text-lg">→</span>
      </Link>
    )}
  </div>
);

const DashboardPage = () => {
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);
  const { products, loading: pLoading } = useSelector((state) => state.products);
  const { farmerOrders, farmerTransparentSubOrders, loading: oLoading } = useSelector((state) => state.orders);

  const [runTutorial, setRunTutorial] = useState(
    !!userInfo?.isFirstLogin && userInfo?.role === "farmer"
  );

  const steps = [
    { target: "[data-tour='farmer-profile']", content: "Update your farm profile so customers can learn about you." },
    { target: "[data-tour='farmer-products']", content: "Add and manage your products here." },
    { target: "[data-tour='farmer-orders']", content: "Track your incoming orders from customers." },
  ];

  const handleJoyrideCallback = async (data) => {
    const { status } = data;
    if (["finished", "skipped"].includes(status) && userInfo?.isFirstLogin) {
      try {
        const token = localStorage.getItem("token");
        await axios.post(
          `${API_URL}/users/tutorial/complete`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (e) { /* ignore */ } finally { setRunTutorial(false); }
    }
  };

  const [visitCount, setVisitCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [chartData, setChartData] = useState({
    salesData: [],
    productPerformance: [],
    visitorStats: []
  });
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    dispatch(getFarmerOrders());
    dispatch(getFarmerTransparentSubOrders());
    dispatch(getFarmerProducts());

    const fetchVisitCount = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get(
          `${API_URL}/visits/requests`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const pendingVisits = data.filter(v => v.status === 'Pending').length;
        setVisitCount(pendingVisits);
      } catch (error) {
        console.error("Error fetching visit count:", error);
      }
    };
    fetchVisitCount();

    const fetchChartData = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get(
          `${API_URL}/farmer/dashboard/charts`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setChartData(data.data);
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
      }
    };
    fetchChartData();

    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const { data } = await axios.get(
          `${API_URL}/notifications`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotifications(data?.data || []);
      } catch {
        // non-blocking
      }
    };
    fetchNotifications();

    const observer = new MutationObserver(() => {
      setDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [dispatch]);

  const urgentNotification = useMemo(
    () =>
      notifications.find(
        (n) =>
          n._id !== dismissedAnnouncementId
      ) || null,
    [notifications, dismissedAnnouncementId]
  );

  // Updated Socket.IO connection to fix 400 errors and Offline status
  useEffect(() => {
    if (!userInfo?._id) return;

    // Forcing websocket to avoid polling errors
    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('user:register', userInfo._id);
    });

    socket.on('order:created', (data) => {
      if (data.farmer === userInfo._id) {
        dispatch(getFarmerOrders());
        toast.success('✓ New order received!', {
          icon: <FaBell className="text-green-500" />,
          duration: 4000,
        });
      }
    });

    socket.on('order:updated', (data) => {
      if (data.farmer === userInfo._id) {
        dispatch(getFarmerOrders());
        toast.success(`✓ Order status: ${data.status}`, {
          icon: <FaBell className="text-blue-500" />,
          duration: 3000,
        });
      }
    });

    socket.on('stock:low', (data) => {
      if (data.farmer === userInfo._id) {
        dispatch(getFarmerProducts());
        toast.warning('⚠️ Low stock alert!', {
          icon: <FaExclamationTriangle className="text-yellow-500" />,
          duration: 5000,
        });
      }
    });

    socket.on('visit:newRequest', (data) => {
      if (data.farmer === userInfo._id) {
        setVisitCount(prev => prev + 1);
        toast.info('📅 New visit request!', {
          icon: <FaCalendarCheck className="text-purple-500" />,
          duration: 4000,
        });
      }
    });

    socket.on('kyc:updated', (data) => {
      if (data.farmerId === userInfo._id) {
        toast.success(`✓ KYC Status: ${data.status}`, {
          icon: <FaBell className="text-green-500" />,
          duration: 3000,
        });
      }
    });

    socket.on('connect_error', (err) => {
      console.error("Socket Connection Error:", err.message);
      setSocketConnected(false);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [userInfo, dispatch]);

  if (pLoading || oLoading) return <Loader />;

  const currentProducts = Array.isArray(products) ? products : (products?.data || []);
  const productCount = currentProducts.length;

  const totalRevenue = farmerOrders
    ?.filter(order => order.paymentStatus === "paid")
    ?.reduce((acc, order) => acc + (Number(order.totalAmount) || 0), 0) || 0;

  const pendingOrders = farmerOrders?.filter(order => order.status === "pending")?.length || 0;

  const transparentSubOrders = farmerTransparentSubOrders || [];
  const transparentSubtotal = transparentSubOrders.reduce(
    (sum, row) => sum + Number(row.subtotal || 0),
    0
  );
  const transparentCommission = transparentSubOrders.reduce(
    (sum, row) => sum + Number(row.commissionAmount || 0),
    0
  );
  const transparentPayout = transparentSubOrders.reduce(
    (sum, row) => sum + Number(row.payoutAmount || 0),
    0
  );
  const pendingSettlementCount = transparentSubOrders.filter((row) =>
    ["Pending", "Eligible"].includes(row.payoutStatus)
  ).length;

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen font-sans animate-fadeIn">
      {urgentNotification && (
        <ImportantAnnouncementBanner
          title={urgentNotification.title}
          subtitle={urgentNotification.message}
          expiryAt={urgentNotification.endDateTime}
          isPermanent={Boolean(urgentNotification.isPermanent)}
          topOffsetClass="top-[78px]"
          onDismiss={() => setDismissedAnnouncementId(urgentNotification._id)}
          onExpire={() => setDismissedAnnouncementId(urgentNotification._id)}
        />
      )}
      {runTutorial && (
        <Joyride steps={steps} run={runTutorial} continuous showSkipButton callback={handleJoyrideCallback} />
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8" data-tour="farmer-profile">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t("farmerDashboard.title")}</h1>
            <p className="text-gray-600 dark:text-gray-300 font-medium">{t("farmerDashboard.welcome", { name: userInfo?.name || t("farmerDashboard.fallbackName") })}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <div className={`w-3 h-3 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-bold text-gray-500">{socketConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
        <Link to="/farmer/products/add" className="bg-green-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-all shadow-md active:scale-95">
          <FaPlus /> {t("farmerDashboard.addProductCta")}
        </Link>
      </div>

      {/* Stats Cards Grid */}
      {notifications.length > 0 && (
        <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-gray-500 mb-3">
            Announcements
          </h3>
          <div className="space-y-2">
            {notifications.slice(0, 3).map((n) => (
              <div key={n._id} className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl px-3 py-2">
                <p className="text-sm font-bold text-green-700 dark:text-green-300">{n.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={<FaBox className="text-green-600" />} label={t("farmerDashboard.totalProducts")} value={productCount} link="/farmer/products" color="bg-green-100" dataAttr="farmer-products" t={t} />
        <StatCard icon={<FaShoppingCart className="text-orange-600" />} label={t("farmerDashboard.pendingOrders")} value={pendingOrders} link="/farmer/orders" color="bg-orange-100" dataAttr="farmer-orders" t={t} />
        <StatCard icon={<FaComments className="text-blue-600" />} label={t("farmerDashboard.messages")} value="0" link="/messages" color="bg-blue-100" t={t} />
        <StatCard icon={<FaTags className="text-indigo-600" />} label="Deals" value="Manage" link="/farmer/deals" color="bg-indigo-100" t={t} />
        <StatCard icon={<FaCalendarCheck className="text-pink-600" />} label="Visit Requests" value={visitCount} link="/farmer/visits" color="bg-pink-100" t={t} />
        <StatCard icon={<FaExclamationTriangle className="text-red-600" />} label="Complaints" value="Manage" link="/farmer/complaints" color="bg-red-100" t={t} />
        <StatCard icon={<FaChartLine className="text-purple-600" />} label={t("farmerDashboard.totalRevenue")} value={`Rs ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="bg-purple-100" t={t} />
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
        <h2 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-wider mb-4">
          Transparent Settlement Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Subtotal</p>
            <p className="text-xl font-black text-gray-900 dark:text-gray-100">Rs {transparentSubtotal.toFixed(2)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
            <p className="text-[10px] uppercase tracking-widest text-red-500 font-black">Commission Deducted</p>
            <p className="text-xl font-black text-red-700 dark:text-red-400">Rs {transparentCommission.toFixed(2)}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
            <p className="text-[10px] uppercase tracking-widest text-green-600 font-black">Payout Amount</p>
            <p className="text-xl font-black text-green-700 dark:text-green-400">Rs {transparentPayout.toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
            <p className="text-[10px] uppercase tracking-widest text-amber-600 font-black">Settlement Status</p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-400">{pendingSettlementCount} Pending</p>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="space-y-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FaChartLine className="text-green-600 dark:text-green-400" />
              Analytics Dashboard
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your business performance and insights</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6">Sales Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData.salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="month" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                <Tooltip contentStyle={{ backgroundColor: darkMode ? '#1f2937' : '#fff', borderRadius: '12px' }} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Revenue (₨)" />
                <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={3} name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6">Visitor Analytics</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData.visitorStats.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="date" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                <Tooltip />
                <Area type="monotone" dataKey="visits" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6">Top Performing Products</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData.productPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
              <XAxis dataKey="name" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
              <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sold" fill="#10b981" name="Units Sold" radius={[8, 8, 0, 0]} />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (₨)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Payout Settlement Details</h2>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {transparentSubOrders.length} Sub-orders
            </span>
          </div>
          {transparentSubOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="py-3 text-[10px] uppercase tracking-widest text-gray-400 font-black">SubOrder</th>
                    <th className="py-3 text-[10px] uppercase tracking-widest text-gray-400 font-black">Subtotal</th>
                    <th className="py-3 text-[10px] uppercase tracking-widest text-gray-400 font-black">Commission</th>
                    <th className="py-3 text-[10px] uppercase tracking-widest text-gray-400 font-black">Payout</th>
                    <th className="py-3 text-[10px] uppercase tracking-widest text-gray-400 font-black">Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  {transparentSubOrders.slice(0, 8).map((row) => (
                    <tr key={row._id} className="border-b border-gray-50 dark:border-gray-700">
                      <td className="py-3 font-bold text-gray-700 dark:text-gray-300">#{row._id.slice(-6).toUpperCase()}</td>
                      <td className="py-3 font-bold text-gray-800 dark:text-gray-100">Rs {Number(row.subtotal || 0).toFixed(2)}</td>
                      <td className="py-3 font-bold text-red-600">Rs {Number(row.commissionAmount || 0).toFixed(2)}</td>
                      <td className="py-3 font-bold text-green-700 dark:text-green-400">Rs {Number(row.payoutAmount || 0).toFixed(2)}</td>
                      <td className="py-3">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {row.payoutStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No transparent settlement records yet.</p>
          )}
        </div>

        {/* Inventory Table */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FaBox className="text-green-600 dark:text-green-400" size={18} /> {t("farmerDashboard.inventoryStatus")}
            </h2>
            <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-gray-500 dark:text-gray-300 uppercase">
              {t("farmerDashboard.inventorySummary", { count: productCount })}
            </span>
          </div>

          {productCount > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
                    <th className="py-4 px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Product Name</th>
                    <th className="py-4 px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Price/Unit</th>
                    <th className="py-4 px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Current Stock</th>
                    <th className="py-4 px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentProducts.map((p) => {
                    const isLowStock = p.quantityAvailable <= (p.minStockLevel || 5);
                    return (
                      <tr key={p._id} className={`border-b last:border-0 border-gray-50 dark:border-gray-700 hover:bg-gray-50/30 dark:hover:bg-gray-700/30 transition-colors ${isLowStock ? 'bg-red-50/20 dark:bg-red-900/10' : ''}`}>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-700 dark:text-gray-300">{p.name}</span>
                            {isLowStock && <FaExclamationTriangle className="text-red-500 animate-pulse" size={14} />}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center text-sm font-bold text-gray-600 dark:text-gray-400">
                          Rs {p.price} <span className="text-[10px]">/{p.unit}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-4 py-1.5 rounded-xl font-black text-xs ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {p.quantityAvailable} {p.unit}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Link to={`/farmer/products/edit/${p._id}`} className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-green-600 hover:text-white transition-all shadow-sm">
                            <FaEdit size={12} /> Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <FaBox className="mx-auto text-gray-200 mb-4" size={48} />
              <p className="text-gray-400 italic font-medium">{t("farmerDashboard.emptyInventory")}</p>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700" data-tour="farmer-orders">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Recent Orders</h2>
            <Link to="/farmer/orders" className="text-green-600 dark:text-green-400 text-sm font-bold hover:underline">{t("farmerDashboard.viewAll")}</Link>
          </div>
          {farmerOrders?.length > 0 ? (
            <div className="space-y-4">
              {farmerOrders.slice(0, 5).map((order) => (
                <div key={order._id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors border border-gray-50 dark:border-gray-700">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-black text-gray-400 dark:text-gray-500">#{order._id.slice(-8).toUpperCase()}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${order.paymentStatus === "paid" ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {order.paymentStatus}
                    </span>
                    <span className="font-black text-gray-800 dark:text-gray-200">Rs {order.totalAmount}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-400 italic">{t("farmerDashboard.noOrders")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

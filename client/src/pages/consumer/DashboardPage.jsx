import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { getConsumerOrders, getTransparentConsumerOrders } from '../../redux/slices/orderSlice';
import {
  FaHome, FaThLarge, FaHistory, FaShoppingBag, FaUserCircle,
  FaChevronRight, FaStar, FaComments, FaLeaf, FaExclamationTriangle, FaSyncAlt
} from 'react-icons/fa';
import Loader from '../../components/Loader';
import Joyride from 'react-joyride';
import axios from 'axios';
import ImportantAnnouncementBanner from '../../components/ImportantAnnouncementBanner';

const ConsumerDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('home');
  const [notifications, setNotifications] = useState([]);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState(null);

  const { userInfo } = useSelector((state) => state.auth);
  const { orders, transparentOrders, loading } = useSelector((state) => state.orders);

  const [runTutorial, setRunTutorial] = useState(
    !!userInfo?.isFirstLogin && userInfo?.role === "consumer"
  );

  const steps = [
    {
      target: "[data-tour='marketplace']",
      content: "Step 1: Explore the marketplace and discover fresh, local produce.",
    },
    {
      target: "[data-tour='subscriptions']",
      content: "Step 2: Manage your weekly/monthly subscriptions from your orders.",
    },
    {
      target: "[data-tour='cart-nav']",
      content: "Step 3: Quickly access your orders and account from the bottom navigation.",
    },
  ];

  const handleJoyrideCallback = async (data) => {
    const { status } = data;
    if (["finished", "skipped"].includes(status) && userInfo?.isFirstLogin) {
      try {
        const token = localStorage.getItem("token");
        await axios.post(
          `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/users/tutorial/complete`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (e) {
        // ignore failure to avoid breaking UX
      } finally {
        setRunTutorial(false);
      }
    }
  };

  useEffect(() => {
    dispatch(getConsumerOrders());
    dispatch(getTransparentConsumerOrders());
  }, [dispatch]);

  const recentOrders = useMemo(() => {
    const regular = (orders || []).map((o) => ({
      id: o._id,
      status: o.status === "completed" ? "delivered" : o.status,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      transparent: false,
    }));
    const split = (transparentOrders || []).map((o) => ({
      id: o._id,
      status: o.orderStatus || "created",
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      transparent: true,
    }));
    return [...regular, ...split]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [orders, transparentOrders]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const { data } = await axios.get(
          `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/notifications`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotifications(data?.data || []);
      } catch {
        // silent fail to avoid breaking dashboard
      }
    };
    fetchNotifications();
  }, []);

  const urgentNotification = useMemo(
    () =>
      notifications.find(
        (n) =>
          n._id !== dismissedAnnouncementId
      ) || null,
    [notifications, dismissedAnnouncementId]
  );

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
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
        <Joyride
          steps={steps}
          run={runTutorial}
          continuous
          showSkipButton
          callback={handleJoyrideCallback}
        />
      )}
      {/* 👤 USER WELCOME BANNER */}
      <div className="p-6">
        <div className="bg-gradient-to-br from-green-500 via-green-600 to-green-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          {/* Background decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>

          <div className="relative z-10">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-sm">
                <FaUserCircle size={55} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">
                  {t("dashboard.greeting", { name: userInfo?.name || "" })}
                </h2>

              </div>
            </div>
            <p className="text-sm font-bold opacity-90 leading-relaxed max-w-[200px]">
              {userInfo?.email}
            </p>
          </div>
        </div>
      </div>

      {/* 📊 NAVIGATION GRID: Marketplace / Orders / Messages */}
      {notifications.length > 0 && (
        <div className="px-6 mb-4">
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-4">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-gray-500 mb-2">
              Announcements
            </h3>
            <div className="space-y-2">
              {notifications.slice(0, 3).map((n) => (
                <div key={n._id} className="bg-green-50/60 border border-green-100 rounded-xl px-3 py-2">
                  <p className="text-xs font-black text-green-700">{n.title}</p>
                  <p className="text-[11px] text-gray-600">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-6 grid grid-cols-3 gap-3">
        <Link
          to="/products"
          data-tour="marketplace"
          className="bg-white p-4 py-6 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col items-center group active:scale-95 transition text-center"
        >
          <div className="bg-green-50 p-3 rounded-2xl text-green-500 mb-3 group-hover:bg-green-500 group-hover:text-white transition-colors duration-300">
            <FaThLarge size={20} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-tighter text-gray-500">
            Marketplace
          </span>
        </Link>

        <Link
          to="/orders"
          data-tour="subscriptions"
          className="bg-white p-4 py-6 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col items-center group active:scale-95 transition text-center"
        >
          <div className="bg-blue-50 p-3 rounded-2xl text-blue-500 mb-3 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
            <FaHistory size={20} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-tighter text-gray-500">
            {t("dashboard.navOrderHistory")}
          </span>
        </Link>

        <Link
          to="/subscriptions"
          className="bg-white p-4 py-6 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col items-center group active:scale-95 transition text-center"
        >
          <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-500 mb-3 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
            <FaSyncAlt size={20} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-tighter text-gray-500">
            Subscriptions
          </span>
        </Link>

        <Link
          to="/deals"
          className="bg-white p-4 py-6 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col items-center group active:scale-95 transition text-center"
        >
          <div className="bg-red-50 p-3 rounded-2xl text-red-500 mb-3 group-hover:bg-red-500 group-hover:text-white transition-colors duration-300">
            <FaStar size={20} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-tighter text-gray-500">
            Deals
          </span>
        </Link>

        {/* 🟢 ADDED: My Messages Button */}
        <Link to="/messages" className="bg-white p-4 py-6 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col items-center group active:scale-95 transition text-center">
          <div className="bg-green-50 p-3 rounded-2xl text-green-500 mb-3 group-hover:bg-green-500 group-hover:text-white transition-colors duration-300">
            <FaComments size={20} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-titter text-gray-500">
            {t("dashboard.navMyMessages")}
          </span>
        </Link>

        <Link to="/consumer/my-visits" className="bg-white p-4 py-6 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col items-center group active:scale-95 transition text-center">
          <div className="bg-purple-50 p-3 rounded-2xl text-purple-500 mb-3 group-hover:bg-purple-500 group-hover:text-white transition-colors duration-300">
            <FaLeaf size={20} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-tighter text-gray-500">
            Farm Visits
          </span>
        </Link>

        <Link to="/consumer/complaints" className="bg-white p-4 py-6 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col items-center group active:scale-95 transition text-center">
          <div className="bg-rose-50 p-3 rounded-2xl text-rose-500 mb-3 group-hover:bg-rose-500 group-hover:text-white transition-colors duration-300">
            <FaExclamationTriangle size={20} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-tighter text-gray-500">
            My Complaints
          </span>
        </Link>



        <Link to="/profile" className="bg-white p-4 py-6 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col items-center group active:scale-95 transition text-center">
          <div className="bg-orange-50 p-3 rounded-2xl text-orange-500 mb-3 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
            <FaUserCircle size={20} />
          </div>
          <span className="font-black text-[9px] uppercase tracking-titter text-gray-500">
            {t("dashboard.navMyProfile")}
          </span>
        </Link>
      </div>

      {/* 📦 RECENT ORDERS LIST */}
      <div className="mt-10 px-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-gray-800 uppercase tracking-titter">
            {t("dashboard.recentOrders")}
          </h3>
          <Link to="/orders" className="text-green-600 text-xs font-black bg-green-50 px-4 py-2 rounded-full hover:bg-green-100 transition">
            {t("dashboard.viewAll")}
          </Link>
        </div>

        {recentOrders?.length > 0 ? (
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}${order.transparent ? '?transparent=1' : ''}`)}
                className="bg-white p-5 rounded-[2rem] shadow-lg border border-gray-50 flex justify-between items-center cursor-pointer hover:border-green-200 transition"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-green-50 p-3 rounded-2xl text-green-600">
                    <FaShoppingBag size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-800 text-sm italic">ID: #{order.id.slice(-6).toUpperCase()}</p>
                    <p className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md inline-block mt-1 ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                      {order.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="font-black text-green-600 text-sm leading-none">₨{order.totalAmount}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">
                      {t("dashboard.totalPayLabel")}
                    </p>
                  </div>
                  <FaChevronRight className="text-gray-200" size={12} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-[2.5rem] text-center border-2 border-dashed border-gray-200 shadow-inner">
            <FaShoppingBag className="text-gray-200 text-6xl mx-auto mb-4" />
            <p className="font-black text-gray-400 uppercase text-xs tracking-widest">
              {t("dashboard.noRecentOrders")}
            </p>
            <button
              onClick={() => navigate('/products')}
              className="mt-4 text-green-600 font-black text-xs hover:underline uppercase"
            >
              {t("dashboard.startShopping")}
            </button>
          </div>
        )}
      </div>

      {/* 📱 FIXED BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)] z-50 rounded-t-[2rem]">
        <NavItem
          icon={<FaHome />}
          label={t("dashboard.bottomHome")}
          isActive={activeTab === 'home'}
          onClick={() => { setActiveTab('home'); navigate('/'); }}
        />
        <NavItem
          icon={<FaThLarge />}
          label={t("dashboard.bottomCategories")}
          isActive={activeTab === 'cat'}
          onClick={() => { setActiveTab('cat'); navigate('/products'); }}
        />
        <NavItem
          icon={<FaHistory />}
          label={t("dashboard.bottomReorder")}
          isActive={activeTab === 'reorder'}
          onClick={() => { setActiveTab('reorder'); navigate('/orders'); }}
        />
        <NavItem
          icon={<FaShoppingBag />}
          label={t("dashboard.bottomMyOrders")}
          isActive={activeTab === 'orders'}
          onClick={() => { setActiveTab('orders'); navigate('/orders'); }}
        />
        <NavItem
          icon={<FaUserCircle />}
          label={t("dashboard.bottomAccount")}
          isActive={activeTab === 'account'}
          onClick={() => { setActiveTab('account'); navigate('/profile'); }}
        />
      </div>
    </div>
  );
};

// 🔘 Navigation Tab Component
const NavItem = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center transition-all duration-300 relative ${isActive ? 'text-green-600' : 'text-gray-300'}`}
  >
    {isActive && (
      <span className="absolute -top-4 w-1.5 h-1.5 bg-green-600 rounded-full shadow-[0_0_10px_rgba(22,163,74,0.8)]"></span>
    )}
    <div className={`text-2xl mb-1.5 transition-transform ${isActive ? 'scale-125 -translate-y-1' : ''}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-black uppercase tracking-tighter transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`}>
      {label}
    </span>
  </button>
);

export default ConsumerDashboard;

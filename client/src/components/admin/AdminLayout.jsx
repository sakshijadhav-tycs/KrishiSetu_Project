import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Navbar from "../Navbar";
import BackButton from "../BackButton";
import {
  FaBars,
  FaXmark,
  FaGaugeHigh,
  FaUserTie,
  FaUsers,
  FaBox,
  FaTags,
  FaClipboardList,
  FaTriangleExclamation,
  FaCalendarCheck,
  FaStarHalf,
  FaBell,
  FaChartLine,
  FaSliders,
  FaClockRotateLeft,
} from "react-icons/fa6";

const menuItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: FaGaugeHigh },
  { to: "/admin/farmers", label: "Farmer Management", icon: FaUserTie },
  { to: "/admin/products", label: "Product Monitoring", icon: FaBox },
  { to: "/admin/deals", label: "Deals Monitoring", icon: FaTags },
  { to: "/admin/orders", label: "Order Monitoring", icon: FaClipboardList },
  { to: "/admin/complaints", label: "Complaint Center", icon: FaTriangleExclamation },
  { to: "/admin/farm-visits", label: "Farm Visit Requests", icon: FaCalendarCheck },
  { to: "/admin/customers", label: "Customer Management", icon: FaUsers },
  { to: "/admin/reviews", label: "Reviews & Ratings", icon: FaStarHalf },
  { to: "/admin/notifications", label: "Notifications", icon: FaBell },
  { to: "/admin/analytics", label: "Analytics & Reports", icon: FaChartLine },
  { to: "/admin/settings", label: "Settings", icon: FaSliders },
  { to: "/admin/activity-logs", label: "Activity Logs", icon: FaClockRotateLeft },
];

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const sidebarWidthClass = sidebarOpen ? "md:ml-64" : "md:ml-20";
  const isAdminDashboard =
    location.pathname === "/admin/dashboard" || location.pathname === "/admin/dashboard/";

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Navbar />

      {/* Sidebar */}
      <aside
        className={`bg-green-50 border-r border-green-100 shadow-sm dark:bg-gray-900 dark:border-gray-700 fixed top-16 bottom-0 left-0 z-30 transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        } hidden md:flex flex-col`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-green-100 dark:border-gray-700">
          <span className="text-xs font-black tracking-[0.2em] uppercase text-green-700 dark:text-green-400">
            Admin Panel
          </span>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 rounded-xl hover:bg-green-100 dark:hover:bg-gray-800 text-green-700 dark:text-green-400 transition-colors"
          >
            {sidebarOpen ? <FaXmark size={14} /> : <FaBars size={14} />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {menuItems.map((item) => {
            const MenuIcon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200",
                    isActive
                      ? "bg-green-200 text-green-900 shadow-sm dark:bg-gray-800 dark:text-green-400"
                      : "text-green-800 hover:bg-green-100 dark:text-gray-300 dark:hover:bg-gray-800",
                  ].join(" ")
                }
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-green-100 text-green-700 shadow-inner dark:bg-gray-800 dark:text-green-400">
                  <MenuIcon size={14} />
                </span>
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-16 left-0 right-0 z-30 bg-white border-b border-green-100 dark:bg-gray-900 dark:border-gray-700 flex items-center justify-between px-4 h-14 shadow-sm">
        <span className="text-xs font-black tracking-[0.2em] uppercase text-green-700 dark:text-green-400">
          Admin Panel
        </span>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="p-2 rounded-xl hover:bg-green-50 dark:hover:bg-gray-800 text-green-700 dark:text-green-400 transition-colors"
        >
          {sidebarOpen ? <FaXmark size={16} /> : <FaBars size={16} />}
        </button>
      </div>

      {/* Main content */}
      <div className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${sidebarWidthClass}`}>
        <div className="flex-1 overflow-y-auto">
          <header className="hidden md:flex items-center justify-between h-16 px-6 border-b border-green-100 bg-white/90 dark:bg-gray-900/95 dark:border-gray-700 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
            <div>
              <h1 className="text-sm font-black tracking-[0.25em] uppercase text-green-700 dark:text-green-400">
                Welcome back Admin
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="w-9 h-9 rounded-full flex items-center justify-center bg-green-50 text-green-600 shadow-inner border border-green-100">
                <FaBell size={14} />
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-green-500 to-emerald-400 text-white flex items-center justify-center text-xs font-black shadow-md">
                A
              </div>
            </div>
          </header>

          <main className="pt-28 md:pt-6 px-4 md:px-8 pb-8">
            {!isAdminDashboard && (
              <BackButton fallbackTo="/admin/dashboard" className="mb-4" />
            )}
            <Outlet />
          </main>
        </div>
        <footer className="border-t border-green-100 bg-white/80 dark:bg-gray-900 dark:border-gray-700 px-4 md:px-8 py-4 text-xs text-gray-500 dark:text-gray-400">
          Admin Console - कृषीSetu
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;

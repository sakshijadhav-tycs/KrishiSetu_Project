"use client";

import { useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Toaster } from "react-hot-toast";

// Actions
import { loadUser } from "./redux/slices/authSlice";

// Global Components
import Layout from "./components/Layout";
import AdminLayout from "./components/admin/AdminLayout";
import ScrollToTop from "./components/ScrollToTop";
import Loader from "./components/Loader";
// --- FIX: Tutorial Controller Import Kiya Gaya Hai ---
import TutorialController from "./components/TutorialController";
import { useTheme } from "./context/ThemeContext";

// 🛡️ Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, userInfo, isLoaded } = useSelector((state) => state.auth);

  if (!isLoaded) return <Loader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userInfo?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// 🏠 Public Pages
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";

// 👤 Common Protected Pages
import ProfilePage from "./pages/ProfilePage";
import MessagesPage from "./pages/MessagesPage";
import ConversationPage from "./pages/ConversationPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentSuccess from "./pages/PaymentSuccess";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import SubscriptionCheckoutPage from "./pages/SubscriptionCheckoutPage";
import FarmersPage from "./pages/FarmersPage";
import FarmerDetailPage from "./pages/FarmerDetailPage";
import ProductsPage from "./pages/ProductsPage";
import DealsPage from "./pages/DealsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import CartPage from "./pages/CartPage";

// 🛒 Consumer Dashboard
import ConsumerDashboardPage from "./pages/consumer/DashboardPage";
import ConsumerComplaintsPage from "./pages/consumer/ComplaintsPage";

// 🚜 Farmer Pages
import FarmerDashboardPage from "./pages/farmer/DashboardPage";
import FarmerProductsPage from "./pages/farmer/ProductsPage";
import FarmerAddProductPage from "./pages/farmer/AddProductPage";
import FarmerEditProductPage from "./pages/farmer/EditProductPage";
import FarmerOrdersPage from "./pages/farmer/OrdersPage";
import FarmerProfilePage from "./pages/farmer/ProfilePage";
import VisitRequestsPage from "./pages/farmer/VisitRequestsPage";
import MyVisitsPage from "./pages/consumer/MyVisitsPage";
import FarmerComplaintsPage from "./pages/farmer/ComplaintsPage";
import FarmerDealsPage from "./pages/farmer/DealsPage";

// 👑 Admin Pages
import AdminDashboardPage from "./pages/admin/DashboardPage";
import AdminUsersPage from "./pages/admin/UsersPage";
import AdminCategoriesPage from "./pages/admin/CategoriesPage";
import AdminOrdersPage from "./pages/admin/OrdersPage";
import AdminOrderDetailsPage from "./pages/admin/OrderDetailsPage";
import KYCRequestsPage from "./pages/admin/KYCRequests";
import FarmersManagementPage from "./pages/admin/FarmersManagementPage";
import ProductMonitoringPage from "./pages/admin/ProductMonitoringPage";
import ComplaintCenterPage from "./pages/admin/ComplaintCenterPage";
import ReviewsRatingsPage from "./pages/admin/ReviewsRatingsPage";
import NotificationsPage from "./pages/admin/NotificationsPage";
import AnalyticsReportsPage from "./pages/admin/AnalyticsReportsPage";
import ProductAnalyticsPage from "./pages/admin/ProductAnalyticsPage";
import FarmerSettlementDetailPage from "./pages/admin/FarmerSettlementDetailPage";
import SettingsPage from "./pages/admin/SettingsPage";
import ActivityLogsPage from "./pages/admin/ActivityLogsPage";
import AdminDealsPage from "./pages/admin/DealsPage";
import FarmVisitRequestsPage from "./pages/admin/FarmVisitRequestsPage";
import CustomerManagementPage from "./pages/admin/CustomerManagementPage";

function App() {
  const dispatch = useDispatch();
  const { isDark } = useTheme();

  useEffect(() => {
    dispatch(loadUser());
  }, [dispatch]);

  return (
    <>
      {/* Toast notifications setup */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDark ? "#1f2937" : "#0f172a",
            color: "#f8fafc",
            border: "1px solid rgba(148,163,184,0.25)",
          },
        }}
      />

      <ScrollToTop />

      {/* --- FIX: Tutorial Controller ko yaha globally mount kiya hai --- */}
      {/* Yeh har page par "start-tutorial" event ko listen karega */}
      <TutorialController />

      <Routes>
        <Route path="/" element={<Layout />}>
          {/* --- Public Routes --- */}
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="verify-email" element={<VerifyEmail />} />

          {/* --- Common Protected Routes --- */}
          <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="chat/:userId" element={<ProtectedRoute><ConversationPage /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
          <Route path="farmers" element={<FarmersPage />} />
          <Route path="farmers/:id" element={<FarmerDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />

          {/* --- 🛒 Consumer Specific Routes --- */}
          <Route path="consumer">
            <Route
              path="dashboard"
              element={
                <ProtectedRoute allowedRoles={['consumer', 'user']}>
                  <ConsumerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-visits"
              element={
                <ProtectedRoute allowedRoles={['consumer', 'user', 'farmer']}>
                  <MyVisitsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="complaints"
              element={
                <ProtectedRoute allowedRoles={['consumer', 'user']}>
                  <ConsumerComplaintsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route
            path="checkout"
            element={
              <ProtectedRoute allowedRoles={['consumer', 'user']}>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="paymentsuccess"
            element={
              <ProtectedRoute allowedRoles={['consumer', 'user']}>
                <PaymentSuccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="subscriptions"
            element={
              <ProtectedRoute allowedRoles={['consumer', 'user']}>
                <SubscriptionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="subscriptions/checkout/:productId"
            element={
              <ProtectedRoute allowedRoles={['consumer', 'user']}>
                <SubscriptionCheckoutPage />
              </ProtectedRoute>
            }
          />

          {/* --- 🚜 Farmer Specific Routes --- */}
          <Route path="farmer">
            <Route
              path="dashboard"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <FarmerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="products"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <FarmerProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="products/add"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <FarmerAddProductPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="products/edit/:id"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <FarmerEditProductPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <FarmerOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <FarmerProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="visits"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <VisitRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="complaints"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <FarmerComplaintsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="deals"
              element={
                <ProtectedRoute allowedRoles={["farmer"]}>
                  <FarmerDealsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* --- 👑 Admin Specific Routes --- */}
          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="farmers" element={<FarmersManagementPage />} />
            <Route path="products" element={<ProductMonitoringPage />} />
            <Route path="deals" element={<AdminDealsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="orders/:orderId" element={<AdminOrderDetailsPage />} />
            <Route
              path="orders/settlements/farmer/:farmerId"
              element={<FarmerSettlementDetailPage />}
            />
            <Route path="kyc" element={<KYCRequestsPage />} />
            <Route path="complaints" element={<ComplaintCenterPage />} />
            <Route path="farm-visits" element={<FarmVisitRequestsPage />} />
            <Route path="customers" element={<CustomerManagementPage />} />
            <Route path="reviews" element={<ReviewsRatingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="analytics" element={<AnalyticsReportsPage />} />
            <Route path="analytics/products" element={<ProductAnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="activity-logs" element={<ActivityLogsPage />} />
          </Route>

          {/* 404 Not Found */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;

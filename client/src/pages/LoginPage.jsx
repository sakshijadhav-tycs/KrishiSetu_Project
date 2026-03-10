"use client";

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login, clearError } from "../redux/slices/authSlice";
import { FaEnvelope, FaLock, FaLeaf, FaEye, FaEyeSlash } from "react-icons/fa";
import Loader from "../components/Loader";
import axios from "axios";
import { toast } from "react-toastify";
import { API_URL } from "../config/api";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // State for eye toggle
  const [resendLoading, setResendLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loading, error, errorMeta, isAuthenticated, userInfo, isLoaded } = useSelector((state) => state.auth);
  const errorMessage = typeof error === "string" ? error : (error?.message || "");

  const openVerificationLink = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.info("Verification link copied. Opening now...");
    } catch {
      toast.info("Opening verification link...");
    }
    window.open(url, "_blank");
  };

  useEffect(() => {
    if (isLoaded && isAuthenticated && userInfo) {
      const role = userInfo.role;
      if (role === "farmer") {
        navigate("/farmer/dashboard", { replace: true });
        toast.success("Welcome to Farmer Dashboard");
      } else if (role === "admin") {
        navigate("/admin/dashboard", { replace: true });
        toast.success("Welcome Admin");
      } else {
        navigate("/consumer/dashboard", { replace: true });
        toast.success("Welcome back!");
      }
    }
  }, [isAuthenticated, userInfo, isLoaded, navigate]);

  useEffect(() => {
    dispatch(clearError());
    return () => { dispatch(clearError()); };
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      return toast.error("Please fill all fields");
    }
    try {
      await dispatch(login({ email, password })).unwrap();
    } catch (err) {
      if (err?.unverified && err?.verificationUrl) {
        await openVerificationLink(err.verificationUrl);
      }
    }
  };

  const handleResendLink = async () => {
    if (!email) return toast.error("Enter email first");
    setResendLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/resend-verification`, { email });
      if (data.success) {
        toast.success("Verification link sent to your email!");

        // Dev fallback: backend can return direct link when NODE_ENV is not production
        if (data.verificationUrl) await openVerificationLink(data.verificationUrl);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resend link");
    } finally {
      setResendLoading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 p-10 rounded-2xl shadow-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <FaLeaf className="mx-auto text-green-500 dark:text-green-400 text-5xl animate-bounce" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-100 font-serif">
            {t("auth.login.title") || "Sign In"}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Secure access to your KrishiSetu account
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-700 p-4 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-400 font-bold">{errorMessage}</p>
                {errorMessage.toLowerCase().includes("verify") && (
                  <button
                    type="button"
                    onClick={handleResendLink}
                    disabled={resendLoading}
                    className="mt-2 text-xs font-black text-green-700 dark:text-green-400 underline block uppercase tracking-wider hover:text-green-800 dark:hover:text-green-300"
                  >
                    {resendLoading ? "Sending Link..." : "Resend Verification Email"}
                  </button>
                )}
                {errorMeta?.verificationUrl && (
                  <button
                    type="button"
                    onClick={() => openVerificationLink(errorMeta.verificationUrl)}
                    className="mt-2 text-xs font-black text-blue-700 dark:text-blue-400 underline block uppercase tracking-wider hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Open Verification Link
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Email Field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaEnvelope className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="email"
                required
                autoComplete="email"
                className="pl-10 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password Field with Eye Toggle */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="pl-10 pr-10 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-green-500 focus:outline-none transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="flex justify-end px-1">
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-green-600 hover:text-green-800 hover:underline transition-all"
              >
                {t("auth.login.forgotPassword")}
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-lg font-black rounded-xl text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all shadow-lg active:scale-95"
            >
              {t("auth.login.submit").toUpperCase()}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            {t("auth.login.newHere")}{" "}
            <Link to="/register" className="text-green-600 dark:text-green-400 font-bold hover:text-green-800 dark:hover:text-green-300 underline">
              {t("auth.login.createAccount")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

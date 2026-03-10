"use client";

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { register, clearError } from "../redux/slices/authSlice";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaPhone,
  FaLeaf,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import Loader from "../components/Loader";

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "consumer",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });

  // State for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState("");

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loading, error, isAuthenticated, user } = useSelector(
    (state) => state.auth
  );

  useEffect(() => {
    dispatch(clearError());

    if (isAuthenticated) {
      if (user?.role === "admin") {
        navigate("/admin/dashboard");
      } else if (user?.role === "farmer") {
        navigate("/farmer/dashboard");
      } else {
        navigate("/");
      }
    }
  }, [dispatch, isAuthenticated, navigate, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Strict Phone Validation: Only allow digits and max 10 characters
    if (name === "phone") {
      const onlyNums = value.replace(/[^0-9]/g, "");
      if (onlyNums.length <= 10) {
        setFormData({ ...formData, [name]: onlyNums });
      }
      return;
    }

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    if (formData.password !== formData.confirmPassword) {
      setValidationError(t("auth.register.passwordsNoMatch"));
      return;
    }

    if (formData.phone.length !== 10) {
      setValidationError("Phone number must be exactly 10 digits.");
      return;
    }

    const nameParts = formData.name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : " ";

    const userData = {
      firstName,
      lastName,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      phone: formData.phone,
      address: formData.address,
    };

    dispatch(register(userData));
  };

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 glass p-10 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700">
        <div className="text-center">
          <div className="flex justify-center">
            <FaLeaf className="text-green-500 dark:text-green-400 text-4xl" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            {t("auth.register.title")}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t("auth.register.haveAccount")}{" "}
            <Link to="/login" className="font-medium text-green-600 dark:text-green-400 hover:text-green-500">
              {t("auth.register.signInExisting")}
            </Link>
          </p>
        </div>

        {(error || validationError) && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error || validationError}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm">
            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("auth.register.fullName")} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="text-gray-400" />
                </div>
                <input
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="form-input pl-10 w-full border border-gray-300 dark:border-gray-600 p-2 rounded outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder={t("auth.register.fullNamePlaceholder")}
                />
              </div>
            </div>

            {/* Email */}
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    {t("auth.register.email")} *
  </label>
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <FaEnvelope className="text-gray-400" />
    </div>
    <input
      name="email"
      type="email"
      required
      autoComplete="email"
      // Updated pattern below to avoid the "Invalid character in character class" error
      pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,4}$"
      value={formData.email}
      onChange={handleChange}
      className="form-input pl-10 w-full border border-gray-300 dark:border-gray-600 p-2 rounded outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      placeholder={t("auth.register.emailPlaceholder")}
    />
  </div>
</div>

            {/* Phone */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("auth.register.phone")} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaPhone className="text-gray-400" />
                </div>
                <input
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  maxLength="10"
                  pattern="[0-9]{10}"
                  value={formData.phone}
                  onChange={handleChange}
                  className="form-input pl-10 w-full border border-gray-300 dark:border-gray-600 p-2 rounded outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="10 digit mobile number"
                />
              </div>
            </div>

            {/* Password with Eye Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("auth.register.password")} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="text-gray-400" />
                </div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  minLength="6"
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input pl-10 pr-10 w-full border border-gray-300 dark:border-gray-600 p-2 rounded outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder={t("auth.register.passwordPlaceholder")}
                />
                <div 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-green-500 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </div>
              </div>
            </div>

            {/* Confirm Password with Eye Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("auth.register.confirmPassword")} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="text-gray-400" />
                </div>
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="form-input pl-10 pr-10 w-full border border-gray-300 dark:border-gray-600 p-2 rounded outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder={t("auth.register.confirmPasswordPlaceholder")}
                />
                <div 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-green-500 transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("auth.register.roleLabel")} *
              </label>
              <select 
                name="role" 
                value={formData.role} 
                onChange={handleChange} 
                className="form-input w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" 
                required
              >
                <option value="consumer">{t("auth.register.roleConsumer")}</option>
                <option value="farmer">{t("auth.register.roleFarmer")}</option>
              </select>
            </div>

            {/* Address */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("auth.register.addressLabel")} *
              </label>
              <div className="grid grid-cols-1 gap-3">
                <input
                  name="address.street"
                  type="text"
                  required
                  value={formData.address.street}
                  onChange={handleChange}
                  className="form-input border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder={t("auth.register.streetPlaceholder")}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="address.city"
                    type="text"
                    required
                    value={formData.address.city}
                    onChange={handleChange}
                    className="form-input border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder={t("auth.register.cityPlaceholder")}
                  />
                  <input
                    name="address.state"
                    type="text"
                    required
                    value={formData.address.state}
                    onChange={handleChange}
                    className="form-input border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder={t("auth.register.statePlaceholder")}
                  />
                </div>
                <input
                  name="address.zipCode"
                  type="text"
                  required
                  value={formData.address.zipCode}
                  onChange={handleChange}
                  className="form-input border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder={t("auth.register.zipPlaceholder")}
                />
              </div>
            </div>
          </div>

          <div>
            <button 
              type="submit" 
              className="w-full py-3 px-4 border border-transparent text-sm font-bold rounded-md text-white bg-green-600 hover:bg-green-700 active:scale-95 transition-all" 
              disabled={loading}
            >
              {loading ? t("auth.register.submitting") : t("auth.register.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;

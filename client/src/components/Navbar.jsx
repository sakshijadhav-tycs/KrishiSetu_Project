"use client";

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../redux/slices/authSlice";
import { getCategories } from "../redux/slices/categorySlice";
import {
  FaLeaf,
  FaShoppingCart,
  FaTag,
  FaBars,
  FaTimes,
  FaUser,
  FaSignOutAlt,
  FaThLarge,
  FaUserCog,
  FaChevronDown,
  FaChartLine,
  FaGlobe,
  FaQuestionCircle,
  FaMoon,
  FaSun
} from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";
import { BACKEND_URL } from "../config/api";
import { resolveImageUrl } from "../utils/imageUrl";
import { useLanguage } from "../context/LanguageContext";




const Navbar = () => {
  const { language, changeLanguage, resetLanguage } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const marketRef = useRef(null);

  const { isAuthenticated, userInfo: user } = useSelector((state) => state.auth);
  const { cartItems = [] } = useSelector((state) => state.cart || {});
  const { categories = [] } = useSelector((state) => state.categories);
  const profileImageSrc = resolveImageUrl(user?.profileImage, BACKEND_URL);
  const skipCategoryFetchRoutes = new Set([
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ]);

  useEffect(() => {
    if (skipCategoryFetchRoutes.has(location.pathname)) {
      return;
    }
    dispatch(getCategories());
  }, [dispatch, location.pathname]);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
    setIsMarketOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (marketRef.current && !marketRef.current.contains(event.target)) {
        setIsMarketOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    resetLanguage(); 
    setIsProfileOpen(false);
    setIsMenuOpen(false);
    navigate("/login");
  };

  const handleLanguageChange = (langCode) => {
    if (window.i18n) window.i18n.changeLanguage(langCode);
    changeLanguage(langCode); 
  };




  // --- Start Tutorial Event Handler ---
  const handleStartTour = () => {
    window.dispatchEvent(new Event('start-tutorial'));
    setIsMenuOpen(false); // Close mobile menu if open
  };

  return (
    <nav className="sticky top-0 z-[100] transition-colors duration-200 bg-white/86 dark:bg-gray-900/88 backdrop-blur-md border-b border-green-100/70 dark:border-gray-800/80 pt-3 px-0">
      <div className="w-full px-4 md:px-6 py-2 max-w-[1700px] mx-auto rounded-3xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <FaLeaf className="text-green-600 text-2xl group-hover:rotate-12 transition-transform" />
            <span className="text-xl font-black text-green-700 tracking-tight uppercase dark:text-green-400">
              {"\u0915\u0943\u0937\u0940Setu"}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-5">
            <Link className="text-gray-600 dark:text-gray-300 font-semibold hover:text-green-700 dark:hover:text-green-400 transition text-sm uppercase tracking-[0.14em] border-b-2 border-transparent hover:border-green-600 pb-1" to="/">
              {t("navbar.home")}
            </Link>

            <div
              className="relative py-2 market-nav" // Added class for Tutorial Target
              ref={marketRef}
              onMouseEnter={() => setIsMarketOpen(true)}
              onMouseLeave={() => setIsMarketOpen(false)}
            >
              <Link className="flex items-center gap-1 text-gray-600 dark:text-gray-300 font-semibold hover:text-green-700 dark:hover:text-green-400 transition text-sm uppercase tracking-[0.14em] border-b-2 border-transparent hover:border-green-600 pb-1" to="/products">
                {t("navbar.market")} <FaChevronDown size={10} className={`transition-transform ${isMarketOpen ? 'rotate-180' : ''}`} />
              </Link>

              {isMarketOpen && (
                <div className="absolute left-0 mt-0 w-48 bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-100 dark:border-gray-700 py-2">
                  <Link
                    to="/products"
                    className="block px-4 py-2 text-[11px] font-black text-gray-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-gray-700 hover:text-green-600 dark:hover:text-green-400 uppercase tracking-wider"
                  >
                    {t("navbar.allProducts")}
                  </Link>
                  {categories && categories.map((cat) => (
                    <Link
                      key={cat._id}
                      to={`/products?category=${cat._id}`}
                      className="block px-4 py-2 text-[11px] font-black text-gray-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-gray-700 hover:text-green-600 dark:hover:text-green-400 uppercase tracking-wider"
                    >
                      {t(cat.translationKey || `categories.${cat.name}`) || cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link className="text-gray-600 dark:text-gray-300 font-semibold hover:text-green-700 dark:hover:text-green-400 transition text-sm uppercase tracking-[0.14em] border-b-2 border-transparent hover:border-green-600 pb-1" to="/farmers">
              {t("navbar.farmers")}
            </Link>
            <Link className="text-gray-600 dark:text-gray-300 font-semibold hover:text-red-600 dark:hover:text-red-400 transition text-sm uppercase tracking-[0.14em] border-b-2 border-transparent hover:border-red-500 pb-1" to="/deals">
              Deals
            </Link>
            <Link className="text-gray-600 dark:text-gray-300 font-semibold hover:text-green-700 dark:hover:text-green-400 transition text-sm uppercase tracking-[0.14em] border-b-2 border-transparent hover:border-green-600 pb-1" to="/about">
              {t("footer.about")}
            </Link>

            {/* --- Professional "How to Use" Button --- */}
            <button
              onClick={handleStartTour}
              className="flex items-center gap-2 bg-green-50/80 dark:bg-gray-800 text-green-800 dark:text-green-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-95 tutorial-btn-nav"
            >
              <FaQuestionCircle size={14} /> {t("tutorial.howToUse")}
            </button>

            {/* Language Switcher */}
            <div className="flex items-center gap-2 bg-gray-50/90 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 group language-selector">
              <FaGlobe className="text-gray-400 dark:text-gray-500 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" size={14} />
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 outline-none cursor-pointer hover:text-green-600 dark:hover:text-green-400 transition-colors"
              >
                <option className="text-gray-800" value="en">English</option>
                <option className="text-gray-800" value="hi">{"\u0939\u093f\u0902\u0926\u0940 (Hindi)"}</option>
                <option className="text-gray-800" value="mr">{"\u092e\u0930\u093e\u0920\u0940 (Marathi)"}</option>
              </select>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              title="Toggle Dark Mode"
            >
              {theme === "light" ? <FaMoon size={16} /> : <FaSun size={16} />}
            </button>

            {isAuthenticated && user?.role?.toLowerCase() === "consumer" && (
              <Link to="/cart" className="relative p-2.5 bg-gray-50 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-400 transition">
                <FaShoppingCart size={18} />
                {cartItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">{cartItems.length}</span>
                )}
              </Link>
            )}

            {!isAuthenticated ? (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-green-600 dark:text-green-400 font-black text-xs uppercase tracking-widest">
                  {t("navbar.login")}
                </Link>
                <Link to="/register" className="btn btn-primary text-xs uppercase tracking-widest">
                  {t("navbar.join")}
                </Link>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 p-1.5 pr-4 bg-gray-50 dark:bg-gray-800 rounded-full border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-200 dark:hover:border-green-800 transition">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white shadow-sm overflow-hidden">
                    {profileImageSrc ? (
                      <img
                        src={profileImageSrc}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/logo.png";
                        }}
                      />
                    ) : (
                      <FaUser size={14} />
                    )}
                  </div>
                  <span className="font-black text-xs uppercase tracking-widest">{user?.name?.split(" ")[0]}</span>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-3 w-60 bg-white dark:bg-gray-800 shadow-2xl rounded-[1.5rem] border border-gray-100 dark:border-gray-700 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-700 mb-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Signed in as</p>
                      <p className="text-xs font-black text-green-600 dark:text-green-400 truncate">{user?.email}</p>
                    </div>
                    <div className="flex flex-col">
                      {user?.role?.toUpperCase() === "ADMIN" && (
                        <Link className="flex items-center gap-3 px-5 py-3.5 hover:bg-blue-50 dark:hover:bg-gray-700 font-black text-[11px] text-blue-700 dark:text-blue-400 uppercase tracking-widest transition border-b border-gray-50 dark:border-gray-700" to="/admin/dashboard">
                          <FaThLarge /> {t("navbar.adminPanel")}
                        </Link>
                      )}
                      {user?.role?.toUpperCase() === "FARMER" && (
                        <Link className="flex items-center gap-3 px-5 py-3.5 hover:bg-green-50 dark:hover:bg-gray-700 font-black text-[11px] text-green-700 dark:text-green-400 uppercase tracking-widest transition border-b border-gray-50 dark:border-gray-700 dashboard-link" to="/farmer/dashboard">
                          <FaChartLine /> {t("navbar.farmerDashboard")}
                        </Link>
                      )}
                      {user?.role?.toUpperCase() === "CONSUMER" && (
                        <>
                          <Link className="flex items-center gap-3 px-5 py-3.5 hover:bg-blue-50 dark:hover:bg-gray-700 font-black text-[11px] text-blue-700 dark:text-blue-400 uppercase tracking-widest transition border-b border-gray-50 dark:border-gray-700 dashboard-link" to="/consumer/dashboard">
                            <FaThLarge /> {t("navbar.consumerDashboard")}
                          </Link>
                          <Link className="flex items-center gap-3 px-5 py-3.5 hover:bg-purple-50 dark:hover:bg-gray-700 font-black text-[11px] text-purple-700 dark:text-purple-400 uppercase tracking-widest transition border-b border-gray-50 dark:border-gray-700" to="/consumer/my-visits">
                            <FaLeaf /> My Visits
                          </Link>
                        </>
                      )}

                      <Link className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700 font-black text-[11px] text-gray-600 dark:text-gray-300 uppercase tracking-widest transition profile-link" to="/profile">
                        <FaUserCog className="text-gray-400" /> {t("navbar.settings")}
                      </Link>

                      <div className="border-t border-gray-50 dark:border-gray-700 my-1"></div>
                      <button onClick={handleLogout} className="w-full text-left px-5 py-4 hover:bg-red-50 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition">
                        <FaSignOutAlt /> {t("navbar.signOut")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-yellow-400"
            >
              {theme === "light" ? <FaMoon size={16} /> : <FaSun size={16} />}
            </button>
            <button className="p-2 text-gray-600 dark:text-gray-300" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 bg-gray-50 dark:bg-gray-800 rounded-3xl p-6 space-y-4 shadow-inner border border-gray-100 dark:border-gray-700">
            <Link className="block font-black text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest" to="/">
              {t("navbar.home")}
            </Link>
            <Link className="block font-black text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest" to="/products">
              {t("navbar.market")}
            </Link>
            <Link className="block font-black text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest" to="/farmers">
              {t("navbar.farmers")}
            </Link>
            <Link className="block font-black text-red-600 dark:text-red-400 uppercase text-xs tracking-widest" to="/deals">
              <span className="inline-flex items-center gap-2"><FaTag /> Deals</span>
            </Link>
            <Link className="block font-black text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest" to="/about">
              {t("footer.about")}
            </Link>

            {/* Mobile Tutorial Button */}
            <button
              onClick={handleStartTour}
              className="w-full flex items-center justify-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-green-200 dark:border-green-800"
            >
              <FaQuestionCircle /> {t("tutorial.howToUse")}
            </button>

            <div className="flex items-center gap-4 py-2">
              <button onClick={() => handleLanguageChange('en')} className={`text-[10px] font-black uppercase px-2 py-1 rounded ${language === 'en' ? 'bg-green-600 text-white' : 'text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'}`}>EN</button>
              <button onClick={() => handleLanguageChange('hi')} className={`text-[10px] font-black uppercase px-2 py-1 rounded ${language === 'hi' ? 'bg-green-600 text-white' : 'text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'}`}>HI</button>
              <button onClick={() => handleLanguageChange('mr')} className={`text-[10px] font-black uppercase px-2 py-1 rounded ${language === 'mr' ? 'bg-green-600 text-white' : 'text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'}`}>MR</button>
            </div>


            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
              {!isAuthenticated ? (
                <>
                  <Link className="block font-black text-green-600 dark:text-green-400 uppercase text-xs tracking-widest" to="/login">
                    {t("navbar.login")}
                  </Link>
                  <Link className="block font-black text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest" to="/register">
                    {t("navbar.joinUs")}
                  </Link>
                </>
              ) : (
                <>
                  {user?.role?.toUpperCase() === "CONSUMER" && (
                    <Link className="block font-black text-blue-600 dark:text-blue-400 uppercase text-xs tracking-widest" to="/consumer/dashboard">
                      {t("navbar.consumerDashboard")}
                    </Link>
                  )}
                  {user?.role?.toUpperCase() === "FARMER" && (
                    <Link className="block font-black text-green-600 dark:text-green-400 uppercase text-xs tracking-widest" to="/farmer/dashboard">
                      {t("navbar.farmerDashboard")}
                    </Link>
                  )}
                  <Link className="block font-black text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest" to="/profile">
                    {t("navbar.settings")}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full py-4 text-center font-black bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-xs uppercase tracking-widest"
                  >
                    {t("navbar.signOut")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;




import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
// Actions
import { getProducts, clearProductError } from "../redux/slices/productSlice";
import { getAllFarmers, clearFarmerError } from "../redux/slices/farmerSlice";
import { getCategories, clearCategoryError } from "../redux/slices/categorySlice";

// Components
import ProductCard from "../components/ProductCard";
import FarmerCard from "../components/FarmerCard";
import Loader from "../components/Loader";

import {
  FaLeaf,
  FaHome,
  FaUsers,
  FaShoppingBasket,
  FaHandshake,
  FaCheckCircle,
} from "react-icons/fa";

const HomePage = () => {
  const dispatch = useDispatch();

  const { isAuthenticated, isLoaded: authLoaded } = useSelector((state) => state.auth);

  const { products = [], loading: productLoading, error: productError } = useSelector((state) => state.products || {});
  const { farmers = [], loading: farmerLoading, error: farmerError } = useSelector((state) => state.farmers || {});
  const { categories = [], loading: categoryLoading, error: categoryError } = useSelector((state) => state.categories || {});

  useEffect(() => {
    if (authLoaded) {
      dispatch(getProducts({ limit: 8 }));

      if (isAuthenticated) {
        dispatch(getAllFarmers());
        dispatch(getCategories());
      }
    }
  }, [dispatch, authLoaded, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      if (productError && productError !== "No token found") {
        toast.error(`Products: ${productError}`);
        dispatch(clearProductError());
      }
      if (farmerError && farmerError !== "No token found") {
        toast.error(`Farmers: ${farmerError}`);
        dispatch(clearFarmerError());
      }
      if (categoryError && categoryError !== "No token found") {
        toast.error(`Categories: ${categoryError}`);
        dispatch(clearCategoryError());
      }
    }
  }, [productError, farmerError, categoryError, dispatch, isAuthenticated]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <section
        className="relative h-screen flex items-center justify-center bg-no-repeat bg-[#e7f2e6]"
        style={{
          backgroundImage: "url('/home-page1-final.png')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/12 via-transparent to-green-950/10" />
        <div className="absolute inset-y-0 left-0 w-full md:w-[55%] bg-gradient-to-r from-white/92 via-white/74 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-full md:w-[50%] bg-[radial-gradient(circle_at_left_center,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0)_72%)]" />
        <div className="relative z-10 w-full px-4 md:px-10">
          <div className="w-full md:max-w-[48%] md:min-w-[620px] md:pl-6 md:-translate-y-5 text-left animate-fade-in">
            <h1 className="text-[2.5rem] md:text-[3rem] font-extrabold tracking-tight mb-3 text-green-950 leading-[1.2]">
              <span className="inline-flex items-center gap-2">
                Fresh from Farmers
                <FaLeaf className="text-green-700 text-[0.72em]" />
              </span>
              <br />
              <span className="inline-flex items-center gap-2">
                Direct to Your Home
                <FaHome className="text-green-700 text-[0.72em]" />
              </span>
            </h1>
            <p className="max-w-xl text-gray-700 text-[1.1rem] md:text-[1.25rem] leading-relaxed mb-4">
              Buy fresh, local produce directly from farmers.
              <br />
              No middlemen. Fair prices. Trusted quality.
            </p>
            <ul className="mb-8 space-y-2 text-gray-700">
              <li className="flex items-center gap-2">
                <FaCheckCircle className="text-green-600 text-[1rem]" />
                <span>Direct from farmers</span>
              </li>
              <li className="flex items-center gap-2">
                <FaCheckCircle className="text-green-600 text-[1rem]" />
                <span>No middlemen pricing</span>
              </li>
              <li className="flex items-center gap-2">
                <FaCheckCircle className="text-green-600 text-[1rem]" />
                <span>Trusted fresh quality</span>
              </li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link to="/products" className="inline-flex items-center justify-center h-[54px] px-8 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-[1rem] font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                Shop Now
              </Link>
              <Link to="/farmers" className="inline-flex items-center justify-center h-[54px] px-8 rounded-2xl border border-green-300 bg-white/72 text-green-900 text-[1rem] font-bold hover:bg-white hover:border-green-400 hover:-translate-y-0.5 transition-all duration-300">
                Meet Farmers
              </Link>
            </div>
            
          </div>
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold text-center mb-12 dark:text-gray-100">
            {t("features.whyChoose")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <Feature
              icon={<FaLeaf />}
              title={t("features.freshLocalTitle")}
              desc={t("features.freshLocalDesc")}
            />
            <Feature
              icon={<FaUsers />}
              title={t("features.supportFarmersTitle")}
              desc={t("features.supportFarmersDesc")}
            />
            <Feature
              icon={<FaShoppingBasket />}
              title={t("features.seasonalProduceTitle")}
              desc={t("features.seasonalProduceDesc")}
            />
            <Feature
              icon={<FaHandshake />}
              title={t("features.directConnectionTitle")}
              desc={t("features.directConnectionDesc")}
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold dark:text-gray-100">
              {t("home.featuredProducts")}
            </h2>
            <Link to="/products" className="text-green-700 font-semibold hover:text-green-800 transition-colors">
              {t("home.viewAll")}
            </Link>
          </div>
          {productLoading ? <Loader /> : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.slice(0, 4).map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-gray-50 rounded-xl">
              <p className="text-gray-500 mb-4">
                {t("home.loginToSeeProducts")}
              </p>
              <Link to="/login" className="text-green-600 font-bold hover:underline">
                {t("home.loginNow")}
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold text-center mb-10">
            {t("home.browseByCategory")}
          </h2>
          {!isAuthenticated ? (
            <p className="text-center text-gray-500">
              {t("home.loginToExploreCategories")}
            </p>
          ) : categoryLoading ? <Loader /> : categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {categories.map((cat) => (
                <Link key={cat._id} to={`/products?category=${cat._id}`}
                  className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="text-2xl mb-2">{cat.icon}</div>
                  <p className="font-semibold">{cat.name}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">
              {t("home.categoriesComingSoon")}
            </p>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">
              {t("home.ourFarmers")}
            </h2>
            <Link to="/farmers" className="text-green-700 font-semibold hover:text-green-800 transition-colors">
              {t("home.viewAll")}
            </Link>
          </div>
          {!isAuthenticated ? (
            <p className="text-center text-gray-500">
              {t("home.loginToConnectFarmers")}
            </p>
          ) : farmerLoading ? <Loader /> : farmers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {farmers.slice(0, 3).map((farmer) => (
                <FarmerCard key={farmer._id} farmer={farmer} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-10">
              {t("home.noFarmers")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

const Feature = ({ icon, title, desc }) => (
  <div className="bg-white dark:bg-gray-700 p-6 rounded-2xl border border-gray-100 dark:border-gray-600 shadow-sm text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
    <div className="text-green-600 dark:text-green-400 text-3xl mb-4 flex justify-center">{icon}</div>
    <h3 className="font-semibold mb-2 dark:text-gray-100">{title}</h3>
    <p className="text-gray-500 dark:text-gray-300 text-sm">{desc}</p>
  </div>
);

export default HomePage;

"use client";

import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { FaTrash, FaShoppingBag, FaLeaf } from "react-icons/fa";
import { removeFromCart, clearCart } from "../redux/slices/cartSlice";
import { BACKEND_URL } from "../config/api";
import { resolveImageUrl } from "../utils/imageUrl";

const CartPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { cartItems, farmerName } = useSelector((state) => state.cart);
  const uniqueFarmerCount = new Set(cartItems.map((item) => item.farmerId)).size;
  const itemsSubtotal = cartItems.reduce(
    (acc, item) => acc + Number(item.quantity || 0) * Number(item.price || 0),
    0
  );
  const deliveryCharge = cartItems.length > 0 ? 50 : 0;
  const grandTotal = itemsSubtotal + deliveryCharge;

  const checkoutHandler = () => {
    navigate("/checkout");
  };

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = "https://via.placeholder.com/150?text=Product";
  };

  // ✅ UPDATED EMPTY CART LOGIC
  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fadeIn bg-white dark:bg-gray-900">
        <div className="bg-gray-50 dark:bg-gray-800 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
          <FaShoppingBag className="text-gray-300 dark:text-gray-600 text-5xl" />
        </div>
        <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 mb-2 uppercase tracking-tight">
          {t("cart.emptyTitle")}
        </h2>
        <p className="text-gray-400 dark:text-gray-500 font-bold mb-8 uppercase text-xs tracking-widest">
          {t("cart.emptySubtitle")}
        </p>
        <Link
          to="/products"
          className="bg-green-600 text-white px-12 py-4 rounded-2xl font-black shadow-lg hover:bg-green-700 transition inline-block"
        >
          {t("cart.shopNow")}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 pb-10">
      {/* Header section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-6 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto max-w-6xl flex items-center">
          <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">
            {t("cart.header")}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Items List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl flex items-center font-black text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800 text-sm uppercase tracking-widest">
              <FaLeaf className="mr-3" /> {t("cart.sourcingFrom")}{" "}
              {uniqueFarmerCount > 1
                ? `${uniqueFarmerCount} Farmers`
                : (farmerName || t("cart.localFarmer"))}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {cartItems.map((item) => (
                <div key={item.productId} className="flex items-center p-6 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition duration-300">
                  <img
                    src={resolveImageUrl(item.image, BACKEND_URL) || ""}
                    onError={handleImageError}
                    className="w-24 h-24 object-cover rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-gray-700"
                    alt={item.name}
                  />
                  <div className="flex-1 ml-6">
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 mb-1">{item.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase">
                        {item.unit || t("cart.unitFallback")}
                      </span>
                      <p className="text-green-600 dark:text-green-400 font-black text-lg">
                        ₨{item.price} <span className="text-gray-300 dark:text-gray-600 text-sm font-bold mx-1">x</span> {item.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">₨{(item.price * item.quantity).toFixed(2)}</p>
                    <button
                      onClick={() => dispatch(removeFromCart(item.productId))}
                      className="text-red-300 hover:text-red-600 dark:hover:text-red-400 p-2 transition-colors"
                      title={t("cart.removeItemTitle")}
                    >
                      <FaTrash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => dispatch(clearCart())}
              className="text-xs font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition ml-2"
            >
              {t("cart.clearBag")}
            </button>
          </div>

          {/* Checkout Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-2xl border border-gray-50 dark:border-gray-700 sticky top-28">
              <h2 className="text-xl font-black mb-6 uppercase tracking-tight text-gray-400 dark:text-gray-500">
                {t("cart.orderSummary")}
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-400 dark:text-gray-500">
                    {t("cart.itemsLabel", { count: cartItems.length })}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">Rs {itemsSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-400 dark:text-gray-500">{t("cart.delivery")}</span>
                  <span className="text-gray-800 dark:text-gray-200">Rs {deliveryCharge.toFixed(2)}</span>


                </div>
              </div>

              <div className="flex justify-between items-center border-t border-dashed border-gray-200 dark:border-gray-700 pt-6">
                <span className="text-gray-500 dark:text-gray-400 font-black uppercase text-xs">
                  {t("cart.grandTotal")}
                </span>
                <span className="text-3xl font-black text-green-600 dark:text-green-400">
                  Rs {grandTotal.toFixed(2)}
                </span>
              </div>

              <button
                onClick={checkoutHandler}
                className="w-full bg-green-600 text-white py-5 rounded-[1.5rem] mt-8 font-black text-xl shadow-lg hover:bg-green-700 transition active:scale-[0.98] uppercase tracking-widest"
              >
                {t("cart.checkout")}
              </button>

              <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mt-4 font-bold uppercase tracking-tighter">
                {t("cart.secureTransaction")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;

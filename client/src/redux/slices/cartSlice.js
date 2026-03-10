import { createSlice } from "@reduxjs/toolkit";
import { toast } from "react-toastify";

// Helper function: LocalStorage se data nikalne ke liye
const getStorageItem = (key, defaultValue) => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
};

const initialState = {
    cartItems: getStorageItem("cartItems", []),
    farmerId: getStorageItem("cartFarmer", { id: null }).id,
    farmerName: getStorageItem("cartFarmer", { name: null }).name,
};

const cartSlice = createSlice({
    name: "cart",
    initialState,
    reducers: {
        addToCart: (state, action) => {
            const { product, quantity } = action.payload;

            if (!product || !product._id) {
                toast.error("Product information is incomplete.");
                return;
            }

            const existItem = state.cartItems.find((item) => item.productId === product._id);

            if (existItem) {
                // 2. Quantity Update
                state.cartItems = state.cartItems.map((item) =>
                    item.productId === product._id ? { ...item, quantity: item.quantity + quantity } : item
                );
            } else {
                // 3. Farmer metadata (legacy compatibility)
                if (state.cartItems.length === 0) {
                    state.farmerId = product.farmer?._id || "unknown";
                    state.farmerName = product.farmer?.name || "Local Farmer";
                    localStorage.setItem("cartFarmer", JSON.stringify({ id: state.farmerId, name: state.farmerName }));
                }

                // 4. Naya Item Add karna
                state.cartItems.push({
                    productId: product._id,
                    name: product.name,
                    image: product.images && product.images.length > 0 ? product.images[0] : (product.image || null),
                    price: product.price,
                    quantity: quantity,
                    unit: product.unit || "kg",
                    farmerId: product.farmer?._id || "unknown",
                    farmerName: product.farmer?.name || "Local Farmer",
                });
                toast.success(`${product.name} added to cart!`);
            }
            localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
        },

        removeFromCart: (state, action) => {
            state.cartItems = state.cartItems.filter((item) => item.productId !== action.payload);
            
            // Agar cart khali ho jaye toh farmer info bhi reset kar dein
            if (state.cartItems.length === 0) {
                state.farmerId = null;
                state.farmerName = null;
                localStorage.removeItem("cartFarmer");
            }
            localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
        },

        // ✅ Clear Cart Action: Payment success ke baad ise hi call karein
        clearCart: (state) => {
            state.cartItems = [];
            state.farmerId = null;
            state.farmerName = null;
            localStorage.removeItem("cartItems");
            localStorage.removeItem("cartFarmer");
            // Note: Hum yahan toast nahi dikha rahe kyunki payment success khud ek message dikhayega
        },
    },
});



export const { addToCart, removeFromCart, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

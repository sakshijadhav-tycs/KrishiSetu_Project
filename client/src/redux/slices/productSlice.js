import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Helper function for Auth Config
const getAuthConfig = (getState) => {
  const state = getState();
  // State se ya direct localStorage se token uthayein
  const token = state.auth?.token || localStorage.getItem("token");
  
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  // NOTE: multipart/form-data yahan set NA karein. 
  // Axios aur Browser usey khud handle karenge boundary ke saath.
  return { headers };
};

// --- THUNKS ---

// 1. Get All Products (Public - No Token Needed)
export const getProducts = createAsyncThunk(
  "products/getProducts",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API_URL}/products`);
      return data.data || data;
    } catch (error) {
      return rejectWithValue(null); 
    }
  }
);

// 2. Get Farmer Products (Private - Token Required)
export const getFarmerProducts = createAsyncThunk(
  "products/getFarmerProducts",
  async (_, { rejectWithValue, getState }) => {
    const token = localStorage.getItem("token");
    if (!token || token === "null") return rejectWithValue(null); 

    try {
      const config = getAuthConfig(getState);
      const { data } = await axios.get(`${API_URL}/products/farmer/me`, config);
      return data.data || data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Session expired");
    }
  }
);

// 3. Create Product (Multipart/FormData handle karega)
export const createProduct = createAsyncThunk(
  "products/createProduct",
  async (productData, { rejectWithValue, getState }) => {
    try {
      const config = getAuthConfig(getState);
      // FormData bhejte waqt Content-Type header manually set nahi karte
      // 60s timeout so UI doesn't hang forever if server/Cloudinary is slow
      const { data } = await axios.post(`${API_URL}/products`, productData, {
        ...config,
        timeout: 60000,
      });
      return data;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        return rejectWithValue("Request timed out. Please check your connection and try again.");
      }
      return rejectWithValue(error.response?.data?.message || "Failed to create product");
    }
  }
);

// 4. Update Product
export const updateProduct = createAsyncThunk(
  "products/updateProduct",
  async ({ id, productData }, { rejectWithValue, getState }) => {
    try {
      const config = getAuthConfig(getState);
      const { data } = await axios.put(`${API_URL}/products/${id}`, productData, {
        ...config,
        timeout: 60000,
      });
      return data;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        return rejectWithValue("Request timed out. Please check your connection and try again.");
      }
      return rejectWithValue(error.response?.data?.message || "Failed to update product");
    }
  }
);

export const getProductDetails = createAsyncThunk(
  "products/getProductDetails",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API_URL}/products/${id}`);
      return data.data || data;
    } catch (error) {
      return rejectWithValue(null); 
    }
  }
);

export const deleteProduct = createAsyncThunk(
  "products/deleteProduct",
  async (id, { rejectWithValue, getState }) => {
    try {
      const config = getAuthConfig(getState);
      await axios.delete(`${API_URL}/products/${id}`, config);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Failed to delete product");
    }
  }
);

// --- SLICE ---

const initialState = {
  products: [],
  product: null,
  loading: false,
  error: null,
  success: false,
};

const productSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    clearProductError: (state) => { state.error = null; },
    clearProductDetails: (state) => { state.product = null; },
    resetProductSuccess: (state) => { state.success = false; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
      })
      .addCase(getFarmerProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload;
      })
      .addCase(getProductDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.product = action.payload;
      })
      .addCase(createProduct.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(updateProduct.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.products = state.products.filter((p) => p._id !== action.payload);
      })
      .addMatcher(
        (action) => action.type.endsWith("/pending"),
        (state) => { 
          state.loading = true; 
          state.error = null; 
        }
      )
      .addMatcher(
        (action) => action.type.endsWith("/rejected"),
        (state, action) => {
          state.loading = false;
          if (action.payload) {
            state.error = action.payload;
          }
        }
      );
  },
});

export const { clearProductError, clearProductDetails, resetProductSuccess } = productSlice.actions;
export default productSlice.reducer;
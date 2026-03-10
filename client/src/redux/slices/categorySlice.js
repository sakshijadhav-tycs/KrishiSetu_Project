import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import toast from "react-hot-toast"; 

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/* ======================
    THUNKS
====================== */

// 1. Get all categories (Public - startup par call hota hai)
export const getCategories = createAsyncThunk(
  "categories/getCategories",
  async (_, { rejectWithValue }) => {
    try {
      // ✅ FIX: Public route ke liye koi token check ki zaroorat nahi hai
      const { data } = await axios.get(`${API_URL}/categories`);
      return data.data || data;
    } catch (error) {
      // ✅ FIX: Startup par notification block karne ke liye null return karein
      return rejectWithValue(null);
    }
  }
);

// 2. Create category (admin only)
export const createCategory = createAsyncThunk(
  "categories/createCategory",
  async (categoryData, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const token = state.auth?.token || localStorage.getItem("token");

      if (!token || token === "null") return rejectWithValue("Login as Admin required");

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      const { data } = await axios.post(`${API_URL}/categories`, categoryData, config);
      return data.data || data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create category"
      );
    }
  }
);

// 3. Update category (admin only)
export const updateCategory = createAsyncThunk(
  "categories/updateCategory",
  async ({ id, categoryData }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const token = state.auth?.token || localStorage.getItem("token");

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      const { data } = await axios.put(`${API_URL}/categories/${id}`, categoryData, config);
      return data.data || data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update category"
      );
    }
  }
);

// 4. Delete category (admin only)
export const deleteCategory = createAsyncThunk(
  "categories/deleteCategory",
  async (id, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const token = state.auth?.token || localStorage.getItem("token");

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      await axios.delete(`${API_URL}/categories/${id}`, config);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete category"
      );
    }
  }
);

/* ======================
    SLICE
====================== */

const initialState = {
  categories: [],
  loading: false,
  error: null,
  success: false,
};

const categorySlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    clearCategoryError: (state) => {
      state.error = null;
    },
    resetCategorySuccess: (state) => {
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.categories.push(action.payload);
        toast.success("Category created successfully!");
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.categories = state.categories.map((cat) =>
          cat._id === action.payload._id ? action.payload : cat
        );
        toast.success("Category updated successfully!");
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = state.categories.filter((cat) => cat._id !== action.payload);
        toast.success("Category deleted successfully!");
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
          
          // ✅ FIX: "No token found" jaisa noise state mein nahi jayega
          if (action.payload) {
            state.error = action.payload;
            
            // Manual admin actions ke liye hi toast dikhayein
            const isManualAction = action.type.includes("createCategory") || 
                                 action.type.includes("updateCategory") || 
                                 action.type.includes("deleteCategory");
            
            if (isManualAction) {
               toast.error(action.payload);
            }
          }
        }
      );
  },
});

export const { clearCategoryError, resetCategorySuccess } = categorySlice.actions;
export default categorySlice.reducer;
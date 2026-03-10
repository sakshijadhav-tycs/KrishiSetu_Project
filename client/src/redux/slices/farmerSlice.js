import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import toast from "react-hot-toast"; 

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/* ======================
    THUNKS
====================== */

// 1. Get All Farmers (Public - Startup par call hota hai)
export const getAllFarmers = createAsyncThunk(
  "farmers/getAllFarmers",
  async (_, { rejectWithValue }) => {
    try {
      // ✅ Public route ke liye koi token ki zaroorat nahi hai
      const { data } = await axios.get(`${API_URL}/users/farmers`);
      return data.data || data;
    } catch (error) {
      // ✅ FIX: Startup par error ko state mein na bhejein (silent)
      return rejectWithValue(null);
    }
  }
);

// 2. Get Farmer profile (public)
export const getFarmerProfile = createAsyncThunk(
  "farmers/getFarmerProfile",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API_URL}/users/farmers/${id}`);
      return data.data || data;
    } catch (error) {
      return rejectWithValue(null);
    }
  }
);

// 3. Update farmer profile (Private - Requires Token)
export const updateFarmerProfile = createAsyncThunk(
  "farmers/updateFarmerProfile",
  async (profileData, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      // ✅ FIX: "null" ya "undefined" string check add kiya
      const token = state.auth.token || localStorage.getItem("token");

      if (!token || token === "null" || token === "undefined") {
        return rejectWithValue("Please login to update profile");
      }

      const { data } = await axios.put(
        `${API_URL}/users/farmers/profile`,
        profileData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return data.data || data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update profile"
      );
    }
  }
);

/* ======================
    SLICE
====================== */

const initialState = {
  farmers: [],
  farmerProfile: null,
  myProfile: null,
  loading: false,
  error: null,
  success: false,
};

const farmerSlice = createSlice({
  name: "farmers",
  initialState,
  reducers: {
    clearFarmerError: (state) => {
      state.error = null;
    },
    clearFarmerProfile: (state) => {
      state.farmerProfile = null;
    },
    resetFarmerSuccess: (state) => {
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      /* 1. Fulfillment Cases */
      .addCase(getAllFarmers.fulfilled, (state, action) => {
        state.loading = false;
        state.farmers = action.payload;
      })
      .addCase(getFarmerProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.farmerProfile = action.payload;
      })
      .addCase(updateFarmerProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.myProfile = action.payload;
        toast.success("Profile updated successfully");
      })

      /* 2. Status Matchers */
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
          
          // ✅ SOLVED: "No token found" jaisa message state mein nahi jayega
          // agar payload null hai ya dispatch startup par bina login ke hua hai
          if (action.payload) {
            state.error = action.payload;
            
            // Mutation (update) ke liye hi toast dikhayein
            if (action.type.includes("updateFarmerProfile")) {
               toast.error(action.payload);
            }
          }
        }
      );
  },
});

export const {
  clearFarmerError,
  clearFarmerProfile,
  resetFarmerSuccess,
} = farmerSlice.actions;

export default farmerSlice.reducer;
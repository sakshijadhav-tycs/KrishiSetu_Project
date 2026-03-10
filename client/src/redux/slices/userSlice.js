import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL;

// ✅ UPDATED: Get all Farmers (Added Authorization Header)
export const getAllFarmers = createAsyncThunk(
  "users/getAllFarmers",
  async (_, { rejectWithValue, getState }) => {
    try {
      // Token ko auth state se nikaalte hain
      const token = getState().auth.token;

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const { data } = await axios.get(`${API_URL}/users?role=farmer`, config);
      return data;
    } catch (error) {
      const message =
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message;
      return rejectWithValue(message);
    }
  }
);

// Get all users (admin only)
export const getAllUsers = createAsyncThunk(
  "users/getAllUsers",
  async (_, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const { data } = await axios.get(`${API_URL}/users`, config);
      return data;
    } catch (error) {
      const message =
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message;
      return rejectWithValue(message);
    }
  }
);

// Delete user (admin only)
export const deleteUser = createAsyncThunk(
  "users/deleteUser",
  async (id, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      await axios.delete(`${API_URL}/users/${id}`, config);
      return id;
    } catch (error) {
      const message =
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message;
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  users: [],
  farmers: [],
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    clearUserError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get all Farmers
      .addCase(getAllFarmers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllFarmers.fulfilled, (state, action) => {
        state.loading = false;
        // Backend response format ke hisaab se action.payload.data check karein
        state.farmers = action.payload.data || action.payload;
      })
      .addCase(getAllFarmers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get all users
      .addCase(getAllUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.data;
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete user
      .addCase(deleteUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter((user) => user._id !== action.payload);
        toast.success("User deleted successfully!");
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload);
      });
  },
});

export const { clearUserError } = userSlice.actions;
export default userSlice.reducer;
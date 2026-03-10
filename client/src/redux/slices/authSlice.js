import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { toast } from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/* --- Initial State Helpers --- */
const userFromStorage = localStorage.getItem("userInfo") 
    ? JSON.parse(localStorage.getItem("userInfo")) 
    : null;

const tokenFromStorage = localStorage.getItem("token") || null;

/* --- Thunks --- */

// Register
export const register = createAsyncThunk("auth/register", async (userData, { rejectWithValue }) => {
    try {
        const { data } = await axios.post(`${API_URL}/auth/register`, userData);
        return data; 
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Registration failed");
    }
});

// Login
export const login = createAsyncThunk("auth/login", async (userData, { rejectWithValue }) => {
    try {
        const { data } = await axios.post(`${API_URL}/auth/login`, userData);
        
        // Save to LocalStorage
        localStorage.setItem("token", data.token);
        localStorage.setItem("userInfo", JSON.stringify(data.user)); 
        
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: "Login failed" });
    }
});

// Forgot Password
export const forgotPassword = createAsyncThunk("auth/forgotPassword", async (email, { rejectWithValue }) => {
    try {
        const { data } = await axios.post(`${API_URL}/auth/forgot-password`, { email });
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to send OTP");
    }
});

// Reset Password
export const resetPassword = createAsyncThunk("auth/resetPassword", async (resetData, { rejectWithValue }) => {
    try {
        const { data } = await axios.post(`${API_URL}/auth/reset-password`, resetData);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Failed to reset password");
    }
});

// Update Profile
export const updateProfile = createAsyncThunk("auth/updateProfile", async (userData, { rejectWithValue, getState }) => {
    try {
        const token = getState().auth.token || localStorage.getItem("token");
        const { data } = await axios.put(`${API_URL}/auth/profile`, userData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        // Update storage with new user data
        const updatedUser = data.user || data.data || data;
        localStorage.setItem("userInfo", JSON.stringify(updatedUser));
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Update failed");
    }
});

// Load User (Maintains session on refresh)
export const loadUser = createAsyncThunk("auth/loadUser", async (_, { rejectWithValue }) => {
    try {
        const token = localStorage.getItem("token");
        if (!token) return rejectWithValue("No token found");
        
        const { data } = await axios.get(`${API_URL}/auth/profile`, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        
        // Update storage with fresh data from DB
        const user = data.user || data.data || data;
        localStorage.setItem("userInfo", JSON.stringify(user));
        return data;
    } catch (error) {
        localStorage.removeItem("token");
        localStorage.removeItem("userInfo");
        return rejectWithValue(error.response?.data?.message || "Session expired");
    }
});

// Logout
export const logout = createAsyncThunk("auth/logout", async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userInfo");
    return null;
});

/* --- Slice --- */
const authSlice = createSlice({
    name: "auth",
    initialState: {
        token: tokenFromStorage,
        userInfo: userFromStorage, 
        isAuthenticated: !!tokenFromStorage,
        loading: false,
        error: null,
        errorMeta: null,
        isLoaded: false, 
    },
    reducers: {
        clearError: (state) => {
            state.error = null;
            state.errorMeta = null;
        },
    },
    extraReducers: (builder) => {
        builder
            /* Register */
            .addCase(register.pending, (state) => { state.loading = true; })
            .addCase(register.fulfilled, (state, action) => {
                state.loading = false;
                toast.success(action.payload.message || "Registration Successful!");
            })
            .addCase(register.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                toast.error(action.payload);
            })

            /* Login */
            .addCase(login.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.errorMeta = null;
            })
            .addCase(login.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.isLoaded = true;
                state.token = action.payload.token;
                state.userInfo = action.payload.user;
                toast.success("Welcome back!");
            })
            .addCase(login.rejected, (state, action) => {
                state.loading = false;
                const payload = action.payload;
                state.errorMeta = payload && typeof payload === "object" ? payload : null;
                state.error =
                    (payload && typeof payload === "object" ? payload.message : payload) ||
                    "Login failed";
                toast.error(state.error);
            })

            /* Password Actions */
            .addCase(forgotPassword.fulfilled, (state) => {
                state.loading = false;
                toast.success("OTP sent to your email!");
            })
            .addCase(forgotPassword.rejected, (state, action) => {
                state.loading = false;
                toast.error(action.payload);
            })
            .addCase(resetPassword.fulfilled, (state) => {
                state.loading = false;
                toast.success("Password updated successfully!");
            })
            .addCase(resetPassword.rejected, (state, action) => {
                state.loading = false;
                toast.error(action.payload);
            })

            /* Load User */
            .addCase(loadUser.pending, (state) => { state.loading = true; })
            .addCase(loadUser.fulfilled, (state, action) => {
                state.loading = false;
                state.isLoaded = true;
                state.isAuthenticated = true;
                // ✅ FIXED: Handle different possible data structures from backend
                state.userInfo = action.payload.user || action.payload.data || action.payload;
            })
            .addCase(loadUser.rejected, (state) => {
                state.loading = false;
                state.isLoaded = true; 
                state.isAuthenticated = false;
                state.userInfo = null;
                state.token = null;
            })

            /* Update Profile */
            .addCase(updateProfile.fulfilled, (state, action) => {
                state.userInfo = action.payload.user || action.payload.data || action.payload;
                toast.success("Profile updated!");
            })

            /* Logout */
            .addCase(logout.fulfilled, (state) => {
                state.token = null;
                state.userInfo = null;
                state.isAuthenticated = false;
                state.isLoaded = true;
                toast.success("Logged out successfully");
            });
    }
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { toast } from "react-toastify";
import { clearCart } from "./cartSlice";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getConfig = (getState) => {
  const token = getState().auth.token || localStorage.getItem("token");
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
};

export const createOrder = createAsyncThunk(
  "orders/createOrder",
  async (orderData, { rejectWithValue, getState, dispatch }) => {
    try {
      const { data } = await axios.post(`${API_URL}/orders`, orderData, getConfig(getState));
      dispatch(clearCart());
      localStorage.removeItem("cartItems");
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const getConsumerOrders = createAsyncThunk(
  "orders/getConsumerOrders",
  async (_, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.get(`${API_URL}/orders/consumer`, getConfig(getState));
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const getFarmerOrders = createAsyncThunk(
  "orders/getFarmerOrders",
  async ({ category = "all", paymentMethod = "all" } = {}, { rejectWithValue, getState }) => {
    try {
      const params = new URLSearchParams();
      params.set("category", category);
      params.set("paymentMethod", paymentMethod);
      const { data } = await axios.get(`${API_URL}/orders/farmer?${params.toString()}`, getConfig(getState));
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const getOrderDetails = createAsyncThunk(
  "orders/getOrderDetails",
  async (id, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.get(`${API_URL}/orders/${id}`, getConfig(getState));
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  "orders/updateOrderStatus",
  async ({ id, status }, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.put(`${API_URL}/orders/${id}`, { status }, getConfig(getState));
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const cancelOrder = createAsyncThunk(
  "orders/cancelOrder",
  async (id, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.put(`${API_URL}/orders/${id}/cancel`, {}, getConfig(getState));
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const cancelOrderByFarmer = createAsyncThunk(
  "orders/cancelOrderByFarmer",
  async ({ id, reason }, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.post(
        `${API_URL}/orders/${id}/cancel-by-farmer`,
        { reason },
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const getAllOrders = createAsyncThunk(
  "orders/getAllOrders",
  async (_, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.get(`${API_URL}/orders`, getConfig(getState));
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const createTransparentCheckout = createAsyncThunk(
  "orders/createTransparentCheckout",
  async (payload, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.post(
        `${API_URL}/transparent-orders/checkout/create-order`,
        payload,
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const verifyTransparentCheckout = createAsyncThunk(
  "orders/verifyTransparentCheckout",
  async (payload, { rejectWithValue, getState, dispatch }) => {
    try {
      const { data } = await axios.post(
        `${API_URL}/transparent-orders/checkout/verify`,
        payload,
        getConfig(getState)
      );
      dispatch(clearCart());
      localStorage.removeItem("cartItems");
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const getTransparentConsumerOrders = createAsyncThunk(
  "orders/getTransparentConsumerOrders",
  async (_, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.get(
        `${API_URL}/transparent-orders/my-orders`,
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const getTransparentOrderDetails = createAsyncThunk(
  "orders/getTransparentOrderDetails",
  async (id, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.get(
        `${API_URL}/transparent-orders/${id}`,
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const getFarmerTransparentSubOrders = createAsyncThunk(
  "orders/getFarmerTransparentSubOrders",
  async ({ paymentMethod = "all" } = {}, { rejectWithValue, getState }) => {
    try {
      const params = new URLSearchParams();
      params.set("paymentMethod", paymentMethod);
      const { data } = await axios.get(
        `${API_URL}/transparent-orders/farmer/sub-orders?${params.toString()}`,
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const markFarmerTransparentSubOrderDelivered = createAsyncThunk(
  "orders/markFarmerTransparentSubOrderDelivered",
  async (id, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.patch(
        `${API_URL}/transparent-orders/farmer/sub-orders/${id}/delivered`,
        {},
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const updateFarmerTransparentSubOrderStatus = createAsyncThunk(
  "orders/updateFarmerTransparentSubOrderStatus",
  async ({ id, status, reason = "" }, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.patch(
        `${API_URL}/transparent-orders/farmer/sub-orders/${id}/status`,
        { status, reason },
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const requestTransparentOrderReturn = createAsyncThunk(
  "orders/requestTransparentOrderReturn",
  async ({ id, reason }, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.post(
        `${API_URL}/transparent-orders/${id}/return-request`,
        { reason },
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const reviewFarmerTransparentReturnRequest = createAsyncThunk(
  "orders/reviewFarmerTransparentReturnRequest",
  async ({ id, decision }, { rejectWithValue, getState }) => {
    try {
      const { data } = await axios.patch(
        `${API_URL}/transparent-orders/farmer/sub-orders/${id}/return-request`,
        { decision },
        getConfig(getState)
      );
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

const initialState = {
  orders: [],
  farmerOrders: [],
  transparentOrders: [],
  farmerTransparentSubOrders: [],
  adminOrders: [],
  order: null,
  transparentOrderDetails: null,
  loading: false,
  error: null,
  success: false,
};

const orderSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    clearOrderError: (state) => {
      state.error = null;
    },
    resetOrderState: (state) => {
      state.success = false;
      state.error = null;
      state.loading = false;
      state.order = null;
      state.transparentOrderDetails = null;
    },
    clearOrderDetails: (state) => {
      state.order = null;
      state.transparentOrderDetails = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.order = action.payload.data || action.payload;
        toast.success("Order placed successfully!");
      })
      .addCase(getConsumerOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload.data || action.payload || [];
      })
      .addCase(getFarmerOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.farmerOrders = action.payload.data || action.payload || [];
      })
      .addCase(getOrderDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.order = action.payload.data || action.payload;
      })
      .addCase(getAllOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.adminOrders = action.payload.data || action.payload || [];
      })
      .addCase(createTransparentCheckout.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.order = action.payload.data || action.payload;
      })
      .addCase(verifyTransparentCheckout.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.order = action.payload.data || action.payload;
        toast.success("Payment verified and order created");
      })
      .addCase(getTransparentConsumerOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.transparentOrders = action.payload.data || action.payload || [];
      })
      .addCase(getTransparentOrderDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.transparentOrderDetails = action.payload.data || action.payload;
      })
      .addCase(getFarmerTransparentSubOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.farmerTransparentSubOrders = action.payload.data || action.payload || [];
      })
      .addCase(markFarmerTransparentSubOrderDelivered.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload.data || action.payload;
        state.farmerTransparentSubOrders = state.farmerTransparentSubOrders.map((row) =>
          row._id === updated._id ? updated : row
        );
        toast.success("Sub-order marked delivered");
      })
      .addCase(updateFarmerTransparentSubOrderStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload.data || action.payload;
        state.farmerTransparentSubOrders = state.farmerTransparentSubOrders.map((row) =>
          row._id === updated._id ? updated : row
        );
        toast.success("Sub-order status updated");
      })
      .addCase(requestTransparentOrderReturn.fulfilled, (state) => {
        state.loading = false;
        toast.success("Return request submitted");
      })
      .addCase(reviewFarmerTransparentReturnRequest.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload.data || action.payload;
        state.farmerTransparentSubOrders = state.farmerTransparentSubOrders.map((row) =>
          row._id === updated._id ? updated : row
        );
        if (state.transparentOrderDetails?.subOrders) {
          state.transparentOrderDetails.subOrders = state.transparentOrderDetails.subOrders.map((row) =>
            row._id === updated._id ? updated : row
          );
        }
        toast.success("Return request updated");
      })
      .addMatcher(
        (action) => action.type.startsWith("orders/") && action.type.endsWith("/pending"),
        (state) => {
          state.loading = true;
          state.error = null;
          state.success = false;
        }
      )
      .addMatcher(
        (action) => action.type.startsWith("orders/") && action.type.endsWith("/rejected"),
        (state, action) => {
          state.loading = false;
          state.success = false;
          if (action.payload && action.payload !== "No token found") {
            state.error = action.payload;
            toast.error(action.payload);
          }
        }
      )
      .addMatcher(
        (action) =>
          [
            updateOrderStatus.fulfilled.type,
            cancelOrder.fulfilled.type,
            cancelOrderByFarmer.fulfilled.type,
          ].includes(action.type),
        (state, action) => {
          state.loading = false;
          const updatedOrder = action.payload.data || action.payload;
          state.order = updatedOrder;
          state.orders = state.orders.map((o) => (o._id === updatedOrder._id ? updatedOrder : o));
          state.farmerOrders = state.farmerOrders.map((o) =>
            o._id === updatedOrder._id ? updatedOrder : o
          );
          toast.success(
            action.type === cancelOrder.fulfilled.type
              ? "Order Cancelled Successfully"
              : action.type === cancelOrderByFarmer.fulfilled.type
                ? "Order cancelled by farmer"
              : "Order Status Updated"
          );
        }
      );
  },
});

export const { clearOrderError, resetOrderState, clearOrderDetails } =
  orderSlice.actions;
export default orderSlice.reducer;

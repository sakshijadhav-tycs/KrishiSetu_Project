import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL;

// Helper function to get Auth Config
const getAuthConfig = (getState) => {
  const token = getState().auth.token;
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// --- ASYNC THUNKS ---

// 1. Get all conversations (List loading)
export const getConversations = createAsyncThunk(
  "messages/getConversations",
  async (_, { rejectWithValue, getState }) => {
    try {
      const config = getAuthConfig(getState);
      const { data } = await axios.get(`${API_URL}/messages`, config);
      return data; 
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// 2. Send a new message
export const sendMessage = createAsyncThunk(
  "messages/sendMessage",
  async (messageData, { rejectWithValue, getState }) => {
    try {
      const config = getAuthConfig(getState);
      const { data } = await axios.post(`${API_URL}/messages`, messageData, config);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// 3. Get messages for a specific conversation
export const getConversationMessages = createAsyncThunk(
  "messages/getConversationMessages",
  async (userId, { rejectWithValue, getState }) => {
    try {
      const config = getAuthConfig(getState);
      const { data } = await axios.get(`${API_URL}/messages/${userId}`, config);
      // Backend response normalization: ensuring data array exists
      return { data: data?.data || data, userId }; 
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// 4. Mark a specific user's messages as read
export const markMessagesAsRead = createAsyncThunk(
  "messages/markMessagesAsRead",
  async (userId, { rejectWithValue, getState }) => {
    try {
      const config = getAuthConfig(getState);
      const { data } = await axios.put(`${API_URL}/messages/read/${userId}`, {}, config);
      return { data, userId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// --- INITIAL STATE ---
const initialState = {
  conversations: [],
  messages: {}, // Stores messages indexed by userId
  currentConversation: null,
  loading: false,
  error: null,
};

// --- SLICE ---
const messageSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    clearMessageError: (state) => {
      state.error = null;
    },
    setCurrentConversation: (state, action) => {
      state.currentConversation = action.payload;
    },
    resetMessageState: (state) => {
      state.conversations = [];
      state.messages = {};
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // --- Get Conversations ---
      .addCase(getConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConversations.fulfilled, (state, action) => {
        state.loading = false;
        // ✅ Strict Array Check: prevent .map() crashes in UI
        const incomingData = action.payload?.data || action.payload;
        state.conversations = Array.isArray(incomingData) ? incomingData : [];
        state.error = null;
      })
      .addCase(getConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // --- Send Message ---
      .addCase(sendMessage.pending, (state) => {
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const messageData = action.payload?.data || action.payload;
        if (messageData) {
          const receiverId = messageData.receiver?._id || messageData.receiver;
          if (receiverId) {
            // Ensure array exists for this user before pushing
            if (!state.messages[receiverId]) {
              state.messages[receiverId] = [];
            }
            state.messages[receiverId].push(messageData);
          }
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = action.payload;
        toast.error(action.payload || "Failed to send message");
      })

      // --- Get Conversation Messages ---
      .addCase(getConversationMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConversationMessages.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.userId) {
          const msgData = action.payload.data;
          // ✅ Normalize into array to prevent UI loops
          state.messages[action.payload.userId] = Array.isArray(msgData) ? msgData : [];
        }
      })
      .addCase(getConversationMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // --- Mark as Read ---
      .addCase(markMessagesAsRead.fulfilled, (state, action) => {
        const uId = action.payload.userId;
        // Update unreadCount in the conversations list locally
        state.conversations = state.conversations.map((conv) => 
          conv.user?._id === uId ? { ...conv, unreadCount: 0 } : conv
        );
      });
  },
});

export const { clearMessageError, setCurrentConversation, resetMessageState } = messageSlice.actions;
export default messageSlice.reducer;
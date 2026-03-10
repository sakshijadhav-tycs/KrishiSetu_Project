/**
 * Socket.IO Configuration and Event Handlers
 * Real-time notifications for orders, messages, and visits
 */

import { Server } from "socket.io";

const activeUsers = new Map(); // Store {userId: socketId}
const userSockets = new Map(); // Store {socketId: userId}

/**
 * Initialize Socket.IO from HTTP server
 * @param {http.Server} httpServer - Express HTTP server
 * @returns {Server} Socket.IO instance
 */
export const initializeSocket = (httpServer) => {
  const socketIO = new Server(httpServer, {
    cors: {
      // Updated origin to explicitly match your frontend
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      methods: ["GET", "POST", "OPTIONS"], // Added OPTIONS for stability
      credentials: true,
    },
    // Adding ping settings to prevent silent disconnections
    pingTimeout: 60000,
    pingInterval: 25000,
    // Allowing both but frontend will force 'websocket' as updated earlier
    transports: ["websocket", "polling"],
  });

  /**
   * Connection Event
   */
  socketIO.on("connection", (socket) => {
    console.log(`✓ User connected: ${socket.id}`);

    /**
     * User registers their socket
     * Emitted by: Frontend on login/component mount
     * @event user:register
     */
    socket.on("user:register", (userId) => {
      if (userId) {
        activeUsers.set(userId, socket.id);
        userSockets.set(socket.id, userId);
        console.log(`✓ User registered: ${userId} -> ${socket.id}`);

        // Notify others that user is online
        socket.broadcast.emit("user:online", { userId, timestamp: new Date() });
      }
    });

    /**
     * New Order Created
     * Received by: Farmer whose product is in the order
     */
    socket.on("order:created", (orderData) => {
      const farmerIds = [...new Set(orderData.items.map(item => item.farmer))];
      
      farmerIds.forEach(farmerId => {
        const farmerSocketId = activeUsers.get(farmerId);
        if (farmerSocketId) {
          socketIO.to(farmerSocketId).emit("order:new", {
            orderId: orderData._id,
            consumerName: orderData.consumerName,
            items: orderData.items,
            totalAmount: orderData.totalAmount,
            timestamp: new Date(),
            action: "sound",
          });
        }
      });

      const consumerSocketId = activeUsers.get(orderData.consumer);
      if (consumerSocketId) {
        socketIO.to(consumerSocketId).emit("order:confirmed", {
          orderId: orderData._id,
          status: "pending",
          message: "Order placed successfully",
          timestamp: new Date(),
        });
      }
    });

    /**
     * Order Status Updated
     * Received by: Consumer and relevant farmer
     */
    socket.on("order:statusChanged", (orderData) => {
      const consumerSocketId = activeUsers.get(orderData.consumer);
      if (consumerSocketId) {
        socketIO.to(consumerSocketId).emit("order:updated", {
          orderId: orderData._id,
          status: orderData.status,
          statusLabel: getStatusLabel(orderData.status),
          message: `Order status: ${orderData.status}`,
          timestamp: new Date(),
        });
      }

      const farmerIds = [...new Set(orderData.items.map(item => item.farmer))];
      farmerIds.forEach(farmerId => {
        const farmerSocketId = activeUsers.get(farmerId);
        if (farmerSocketId) {
          socketIO.to(farmerSocketId).emit("order:updated", {
            orderId: orderData._id,
            status: orderData.status,
            timestamp: new Date(),
          });
        }
      });
    });

    /**
     * New Message Handling
     */
    socket.on("message:send", (messageData) => {
      const recipientSocketId = activeUsers.get(messageData.receiverId);
      if (recipientSocketId) {
        socketIO.to(recipientSocketId).emit("message:received", {
          messageId: messageData._id,
          senderId: messageData.senderId,
          senderName: messageData.senderName,
          content: messageData.content,
          relatedOrder: messageData.relatedOrder,
          timestamp: new Date(),
          hasUnread: true,
        });
      }
      socket.emit("message:sent", {
        messageId: messageData._id,
        status: "delivered",
        timestamp: new Date(),
      });
    });

    socket.on("message:read", (messageData) => {
      const senderSocketId = activeUsers.get(messageData.senderId);
      if (senderSocketId) {
        socketIO.to(senderSocketId).emit("message:read-receipt", {
          messageId: messageData.messageId,
          readAt: new Date(),
        });
      }
    });

    /**
     * Visit Requests Real-time Logic
     */
    socket.on("visit:requested", (visitData) => {
      const farmerSocketId = activeUsers.get(visitData.farmerId);
      if (farmerSocketId) {
        socketIO.to(farmerSocketId).emit("visit:newRequest", {
          visitId: visitData._id,
          customerName: visitData.customerName,
          customerEmail: visitData.customerEmail,
          date: visitData.date,
          slot: visitData.slot,
          notes: visitData.notes,
          timestamp: new Date(),
          action: "notification",
        });
      }
      socket.emit("visit:requestCreated", {
        visitId: visitData._id,
        status: "pending",
        message: "Visit request sent to farmer",
        timestamp: new Date(),
      });
    });

    socket.on("visit:respond", (visitData) => {
      const customerSocketId = activeUsers.get(visitData.customerId);
      if (customerSocketId) {
        socketIO.to(customerSocketId).emit("visit:response", {
          visitId: visitData._id,
          farmerId: visitData.farmerId,
          farmerName: visitData.farmerName,
          status: visitData.status,
          message: visitData.status === "Accepted"
              ? "Farmer accepted your visit request"
              : "Farmer rejected your visit request",
          timestamp: new Date(),
        });
      }
    });

    /**
     * KYC & Stock Notifications
     */
    socket.on("kyc:statusChanged", (kycData) => {
      const userSocketId = activeUsers.get(kycData.userId);
      if (userSocketId) {
        socketIO.to(userSocketId).emit("kyc:updated", {
          status: kycData.status,
          message: kycData.message || `KYC status: ${kycData.status}`,
          timestamp: new Date(),
        });
      }
    });

    socket.on("stock:alert", (stockData) => {
      const farmerSocketId = activeUsers.get(stockData.farmerId);
      if (farmerSocketId) {
        socketIO.to(farmerSocketId).emit("stock:low", {
          productId: stockData.productId,
          productName: stockData.productName,
          currentStock: stockData.currentStock,
          timestamp: new Date(),
          urgency: "high",
        });
      }
    });

    /**
     * Typing Indicators
     */
    socket.on("typing:start", (typingData) => {
      const recipientSocketId = activeUsers.get(typingData.recipientId);
      if (recipientSocketId) {
        socketIO.to(recipientSocketId).emit("typing:indicator", {
          userId: typingData.userId,
          userName: typingData.userName,
          isTyping: true,
        });
      }
    });

    socket.on("typing:end", (typingData) => {
      const recipientSocketId = activeUsers.get(typingData.recipientId);
      if (recipientSocketId) {
        socketIO.to(recipientSocketId).emit("typing:indicator", {
          userId: typingData.userId,
          isTyping: false,
        });
      }
    });

    /**
     * Disconnection Handling
     */
    socket.on("disconnect", (reason) => {
      const userId = userSockets.get(socket.id);
      if (userId) {
        activeUsers.delete(userId);
      }
      userSockets.delete(socket.id);
      console.log(`✗ User disconnected: ${socket.id} (Reason: ${reason})`);
      socket.broadcast.emit("user:offline", { userId, timestamp: new Date() });
    });

    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return socketIO;
};

/**
 * Helper Functions
 */
const getStatusLabel = (status) => {
  const labels = {
    pending: "Waiting for farmer confirmation",
    accepted: "Farmer accepted your order",
    rejected: "Farmer rejected your order",
    shipped: "Order is on the way",
    completed: "Order delivered",
    cancelled: "Order cancelled",
  };
  return labels[status] || status;
};

export const broadcastEvent = (socketIO, event, data) => {
  socketIO.emit(event, data);
};

export const sendToUser = (socketIO, userId, event, data) => {
  const socketId = activeUsers.get(userId);
  if (socketId) {
    socketIO.to(socketId).emit(event, data);
  }
};

export const isUserOnline = (userId) => {
  return activeUsers.has(userId);
};
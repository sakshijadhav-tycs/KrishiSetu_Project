/**
 * Custom React Hook for Socket.IO Integration
 * Manages real-time connections and event handlers
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import { BACKEND_URL } from "../config/api";

const SOCKET_URL = BACKEND_URL;

/**
 * useSocket Hook
 * Initialize and manage Socket.IO connection
 */
export const useSocket = () => {
  const socketRef = useRef(null);
  const { userInfo } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  // Initialize socket connection
  useEffect(() => {
    if (!userInfo?._id) return;

    // Connect to socket server
    socketRef.current = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    // Register user on connection
    socketRef.current.emit('user:register', userInfo._id);
    console.log('✓ Socket connected:', userInfo._id);

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userInfo?._id]);

  return socketRef.current;
};

/**
 * Hook for handling order notifications
 */
export const useOrderNotifications = () => {
  const socket = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!socket) return;

    // Listen for new orders
    socket.on('order:new', (orderData) => {
      toast.success(`New order from ${orderData.consumerName}!`, {
        duration: 5000,
        icon: '🎉',
      });

      // Play notification sound (optional)
      playNotificationSound();

      // Dispatch action to update orders in Redux
      // dispatch(updateFarmerOrders(orderData));
    });

    // Listen for order status updates
    socket.on('order:updated', (orderData) => {
      toast.info(`Order ${orderData.orderId}: ${orderData.statusLabel}`, {
        duration: 4000,
      });

      // dispatch(updateOrderStatus(orderData));
    });

    // Listen for order confirmation
    socket.on('order:confirmed', (orderData) => {
      toast.success('Order placed successfully!', {
        duration: 5000,
      });
    });

    return () => {
      socket.off('order:new');
      socket.off('order:updated');
      socket.off('order:confirmed');
    };
  }, [socket, dispatch]);
};

/**
 * Hook for handling message notifications
 */
export const useMessageNotifications = () => {
  const socket = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!socket) return;

    // Listen for incoming messages
    socket.on('message:received', (messageData) => {
      toast.success(`New message from ${messageData.senderName}`, {
        duration: 4000,
      });

      // dispatch(addMessage(messageData));
    });

    // Listen for read receipts
    socket.on('message:read-receipt', (data) => {
      // dispatch(markMessageAsRead(data));
    });

    // Listen for typing indicators
    socket.on('typing:indicator', (data) => {
      // dispatch(setTypingIndicator(data));
    });

    return () => {
      socket.off('message:received');
      socket.off('message:read-receipt');
      socket.off('typing:indicator');
    };
  }, [socket, dispatch]);
};

/**
 * Hook for handling visit request notifications
 */
export const useVisitNotifications = () => {
  const socket = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!socket) return;

    // Listen for new visit requests
    socket.on('visit:newRequest', (visitData) => {
      toast.success(`Visit request from ${visitData.customerName}!`, {
        duration: 5000,
        icon: '👨‍🌾',
      });

      playNotificationSound();

      // dispatch(addVisitRequest(visitData));
    });

    // Listen for visit response
    socket.on('visit:response', (visitData) => {
      const icon = visitData.status === 'Accepted' ? '✅' : '❌';
      toast.success(visitData.message, {
        duration: 4000,
        icon,
      });

      // dispatch(updateVisitStatus(visitData));
    });

    // Listen for visit confirmation
    socket.on('visit:requestCreated', (visitData) => {
      toast.success('Visit request sent!', {
        duration: 3000,
      });
    });

    return () => {
      socket.off('visit:newRequest');
      socket.off('visit:response');
      socket.off('visit:requestCreated');
    };
  }, [socket, dispatch]);
};

/**
 * Hook for handling KYC notifications
 */
export const useKYCNotifications = () => {
  const socket = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!socket) return;

    socket.on('kyc:updated', (kycData) => {
      const icon = kycData.status === 'approved' ? '✅' : 
                   kycData.status === 'rejected' ? '❌' : '⏳';
      
      toast.success(kycData.message, {
        duration: 5000,
        icon,
      });

      // dispatch(updateKYCStatus(kycData));
    });

    return () => {
      socket.off('kyc:updated');
    };
  }, [socket, dispatch]);
};

/**
 * Hook for handling stock alerts
 */
export const useStockAlerts = () => {
  const socket = useSocket();
  const { userInfo } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!socket || userInfo?.role !== 'farmer') return;

    socket.on('stock:low', (stockData) => {
      toast.warning(
        `⚠️ ${stockData.productName}: ${stockData.currentStock}/${stockData.minimumStock}`,
        {
          duration: 6000,
        }
      );
    });

    return () => {
      socket.off('stock:low');
    };
  }, [socket, userInfo?.role]);
};

/**
 * Hook for sending real-time events
 */
export const useSendSocketEvent = () => {
  const socket = useSocket();

  return useCallback(
    (eventName, data) => {
      if (socket) {
        socket.emit(eventName, data);
      } else {
        console.warn('Socket not connected');
      }
    },
    [socket]
  );
};

/**
 * Helper function to play notification sound
 */
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.warn('Could not play notification sound:', error);
  }
};

/**
 * Hook to check if user is online
 */
export const useUserOnlineStatus = (userId) => {
  const socket = useSocket();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on('user:online', (data) => {
      if (data.userId === userId) {
        setIsOnline(true);
      }
    });

    socket.on('user:offline', (data) => {
      if (data.userId === userId) {
        setIsOnline(false);
      }
    });

    return () => {
      socket.off('user:online');
      socket.off('user:offline');
    };
  }, [socket, userId]);

  return isOnline;
};

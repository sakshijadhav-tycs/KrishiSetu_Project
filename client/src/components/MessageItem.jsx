"use client";

import { Link } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";

/**
 * MessageItem Component
 * Renders an individual conversation preview or a farmer profile card.
 */
const MessageItem = ({ conversation, isFarmerList = false }) => {
  // 1. Backend Base URL (Environment variable use karna better hai)
  const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || "http://localhost:5000";

  // ✅ 2. Flexible Data Extraction: 
  // Agar 'isFarmerList' true hai toh data directly 'conversation' mein hoga (as farmer object)
  // Agar false hai toh backend se 'conversation.user' format mein aayega.
  const displayUser = isFarmerList ? conversation : conversation?.user;
  const lastMessage = conversation?.lastMessage;
  const unreadCount = conversation?.unreadCount;

  // ✅ Safety Check: Prevent rendering if user data is missing
  if (!displayUser) {
    return null;
  }

  /**
   * Generates a clean URL for the user's profile image.
   */
  const getAvatarUrl = () => {
    // Check both 'image' and 'avatar' fields based on your different models
    const userImg = displayUser.image || displayUser.avatar?.url || displayUser.kyc?.documentImage;
    
    if (userImg) {
      if (userImg.startsWith('http')) return userImg; // Cloudinary URL
      const path = userImg.replace(/\\/g, "/");
      return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    }
    return null;
  };

  /**
   * Formats the timestamp.
   */
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Link
      // Navigation: Direct chat route par bhejta hai
      to={`/chat/${displayUser._id}`}
      className={`flex items-center justify-between p-4 bg-white hover:bg-green-50 rounded-2xl border transition-all duration-300 shadow-sm group active:scale-[0.98] ${
        isFarmerList ? 'border-gray-200 border-l-4 hover:border-l-green-500' : 'border-gray-100'
      }`}
    >
      <div className="flex items-center space-x-4 min-w-0">
        {/* User Profile Image Section */}
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100 shadow-inner flex items-center justify-center">
          {getAvatarUrl() ? (
            <img
              src={getAvatarUrl()}
              alt={displayUser.name || "User"}
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
              onError={(e) => { 
                e.target.onerror = null; 
                e.target.src = "https://placehold.co/100x100?text=User"; 
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
              <FaUserCircle size={30} />
            </div>
          )}
        </div>

        {/* Message Content Preview */}
        <div className="overflow-hidden flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-800 uppercase text-[11px] tracking-tight truncate">
              {displayUser.name || "Unknown User"}
            </h3>
            {isFarmerList && (
              <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md font-black">
                FARMER
              </span>
            )}
          </div>
          
          <p className="text-gray-500 text-[11px] truncate max-w-[200px] font-medium mt-0.5 leading-tight italic">
            {isFarmerList 
              ? (displayUser.address || "Contact this farmer to start chat") 
              : (lastMessage?.content || "Click to view conversation")}
          </p>
        </div>
      </div>
      
      {/* Notification Status & Time Section */}
      <div className="flex flex-col items-end space-y-1 ml-2">
        {!isFarmerList && lastMessage?.createdAt && (
          <span className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">
            {formatTime(lastMessage.createdAt)}
          </span>
        )}
        
        {unreadCount > 0 && (
          <span className="bg-green-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm shadow-green-200">
            {unreadCount}
          </span>
        )}

        {isFarmerList && (
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        )}
      </div>
    </Link>
  );
};

export default MessageItem;
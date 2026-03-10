/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
} from "../redux/slices/messageSlice";
import Loader from "../components/Loader";
import { FaPaperPlane, FaUserCircle } from "react-icons/fa";
const ConversationPage = () => {
  const { userId } = useParams(); 
  const dispatch = useDispatch();
  const messagesEndRef = useRef(null);

  const [newMessage, setNewMessage] = useState("");
  
  // Redux state extraction
  const { messages = {}, loading } = useSelector((state) => state.messages || {});
  const { userInfo: user } = useSelector((state) => state.auth || {});
  const { farmerProfile } = useSelector((state) => state.farmers || {}); // Farmer profile se naam lene ke liye

  const conversationMessages = messages[userId] || [];

  useEffect(() => {
    if (userId) {
      dispatch(getConversationMessages(userId));
      dispatch(markMessagesAsRead(userId));
    }
  }, [dispatch, userId]);

  // Auto-scroll logic
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;

    dispatch(
      sendMessage({
        receiver: userId,
        content: newMessage.trim(),
      })
    );
    setNewMessage("");
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Improved Partner Name Logic
  const getChatPartnerName = () => {
    if (conversationMessages.length > 0) {
      const firstMsg = conversationMessages[0];
      const partner = firstMsg.sender?._id === user?._id 
        ? firstMsg.receiver 
        : firstMsg.sender;
      return partner?.name || "User";
    }
    // Agar naya chat hai toh farmer profile se naam uthayenge
    return farmerProfile?.farmer?.name || "Farmer";
  };

  if (loading && conversationMessages.length === 0) {
    return <Loader />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800 mb-4 uppercase">
            {t("messages.pleaseLogin")}
          </p>
          <Link to="/login" className="text-green-600 font-bold hover:underline">
            {t("messages.goToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
      {/* 🟢 Header */}
      <div className="bg-white p-4 border-b sticky top-0 z-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
               <FaUserCircle className="text-gray-300 text-4xl" />
               <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h2 className="text-md font-black text-gray-800 uppercase tracking-tight leading-none">
                {getChatPartnerName()}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* 📦 Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#f0f2f5]">
        <div className="max-w-4xl mx-auto w-full">
          {conversationMessages.length > 0 ? (
            <>
              {conversationMessages.map((message, index) => {
                const isMe = message.sender?._id === user?._id || message.sender === user?._id;
                return (
                  <div
                    key={message._id || index}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl font-medium text-[15px] shadow-sm ${
                        isMe
                          ? "bg-green-600 text-white rounded-br-none"
                          : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                      }`}
                    >
                      <p className="leading-relaxed">{message.content}</p>
                      <p
                        className={`text-[9px] mt-1 font-bold uppercase tracking-tighter ${
                          isMe ? "text-green-100" : "text-gray-400"
                        } text-right`}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-20">
              <div className="bg-white p-6 rounded-full shadow-inner mb-4">
                 <FaPaperPlane size={30} className="text-green-100" />
              </div>
              <p className="font-black uppercase tracking-widest">
                {t("messages.noMessagesYet")}
              </p>
              <p className="text-xs italic">
                {t("messages.startConversationWith", {
                  name: getChatPartnerName(),
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ✉️ Input Field */}
      <div className="p-4 bg-white border-t">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            autoFocus
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-gray-100 p-3 px-5 rounded-full border-0 focus:ring-2 focus:ring-green-500 font-medium text-sm transition-all"
            placeholder={t("messages.inputPlaceholder")}
          />
          <button
            type="submit"
            className="bg-green-600 text-white p-3 px-5 rounded-full shadow-md hover:bg-green-700 transition transform active:scale-90 disabled:bg-gray-300 disabled:transform-none"
            disabled={!newMessage.trim()}
          >
            <FaPaperPlane size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConversationPage;

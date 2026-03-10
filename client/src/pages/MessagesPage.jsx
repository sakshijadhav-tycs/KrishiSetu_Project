"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getConversations,
  clearMessageError,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
} from "../redux/slices/messageSlice";
import { getAllFarmers } from "../redux/slices/userSlice";
import MessageItem from "../components/MessageItem";
import Loader from "../components/Loader";
import {
  FaComments,
  FaUserPlus,
  FaChevronLeft,
  FaBell,
  FaPaperPlane,
  FaUserCircle,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { BACKEND_URL } from "../config/api";
import FarmerVerificationBadge from "../components/FarmerVerificationBadge";

const MessagesPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [showFarmers, setShowFarmers] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [newMessage, setNewMessage] = useState("");

  const messagesEndRef = useRef(null);
  const selectedConversationRef = useRef(null);

  const { conversations = [], messages = {}, loading: msgLoading = false } = useSelector(
    (state) => state.messages || {}
  );
  const { farmers = [], loading: userLoading = false } = useSelector((state) => state.users || {});
  const { userInfo } = useSelector((state) => state.auth || {});

  const isFarmer = userInfo?.role === "farmer";

  useEffect(() => {
    dispatch(getConversations());

    if (!isFarmer) {
      dispatch(getAllFarmers());
    }

    return () => {
      dispatch(clearMessageError());
    };
  }, [dispatch, isFarmer]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    if (!userInfo?._id) return;

    const socket = io(BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("user:register", userInfo._id);
    });

    socket.on("message:received", () => {
      dispatch(getConversations());
      if (selectedConversationRef.current) {
        dispatch(getConversationMessages(selectedConversationRef.current));
      }
      toast.success("New message!", {
        icon: <FaBell className="text-green-500" />,
        duration: 3000,
      });
    });

    socket.on("message:read-receipt", () => {
      dispatch(getConversations());
      if (selectedConversationRef.current) {
        dispatch(getConversationMessages(selectedConversationRef.current));
      }
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [userInfo?._id, dispatch]);

  const conversationList = useMemo(() => {
    const safeList = Array.isArray(conversations) ? conversations : [];

    return [...safeList].sort(
      (a, b) =>
        new Date(b?.lastMessage?.createdAt || 0).getTime() -
        new Date(a?.lastMessage?.createdAt || 0).getTime()
    );
  }, [conversations]);

  useEffect(() => {
    if (!isFarmer) return;

    if (conversationList.length === 0) {
      setSelectedConversationId(null);
      return;
    }

    const selectedExists = conversationList.some(
      (conversation) => conversation?.user?._id === selectedConversationId
    );

    if (!selectedConversationId || !selectedExists) {
      setSelectedConversationId(conversationList[0]?.user?._id || null);
    }
  }, [conversationList, isFarmer, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;

    dispatch(getConversationMessages(selectedConversationId));
    dispatch(markMessagesAsRead(selectedConversationId));
  }, [dispatch, selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedConversationId]);

  const selectedConversation = useMemo(() => {
    return (
      conversationList.find((conversation) => conversation?.user?._id === selectedConversationId) || null
    );
  }, [conversationList, selectedConversationId]);

  const selectedMessages = useMemo(() => {
    if (!selectedConversationId) return [];
    return Array.isArray(messages[selectedConversationId]) ? messages[selectedConversationId] : [];
  }, [messages, selectedConversationId]);

  const handleSendMessage = (e) => {
    e.preventDefault();

    const content = newMessage.trim();
    if (!content || !selectedConversationId) return;

    dispatch(
      sendMessage({
        receiver: selectedConversationId,
        content,
      })
    ).then(() => {
      dispatch(getConversationMessages(selectedConversationId));
      dispatch(getConversations());
    });

    setNewMessage("");
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if ((msgLoading || userLoading) && conversationList.length === 0 && (!isFarmer && farmers.length === 0)) {
    return <Loader />;
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl min-h-screen">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-800 uppercase tracking-tighter">
            {showFarmers && !isFarmer ? t("messages.startNewTitle") : t("messages.pageTitle")}
          </h1>
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">
            {t("messages.inboxTagline")}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                socketConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"
              }`}
            ></div>
            <span className="text-xs font-bold text-gray-500">{socketConnected ? "Live" : "Offline"}</span>
          </div>

          {!isFarmer && (
            <button
              onClick={() => setShowFarmers(!showFarmers)}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-[12px] font-bold uppercase transition-all shadow-lg ${
                showFarmers
                  ? "bg-gray-100 text-gray-700"
                  : "bg-green-600 text-white hover:bg-green-700 shadow-green-100"
              }`}
            >
              {showFarmers ? (
                <>
                  <FaChevronLeft /> {t("messages.back")}
                </>
              ) : (
                <>
                  <FaUserPlus /> {t("messages.newChat")}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isFarmer ? (
        conversationList.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-4 animate-fadeIn h-[72vh]">
            <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden">
              <div className="h-full overflow-y-auto p-2">
                {conversationList.map((conversation, index) => {
                  const customer = conversation?.user;
                  const isActive = customer?._id === selectedConversationId;

                  return (
                    <button
                      key={customer?._id || conversation?._id || index}
                      onClick={() => setSelectedConversationId(customer?._id)}
                      className={`w-full text-left flex items-center justify-between gap-3 p-3 rounded-2xl transition-all ${
                        isActive ? "bg-green-50 border border-green-200" : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <FaUserCircle className="text-gray-400 text-2xl" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-gray-800 text-xs uppercase tracking-tight truncate">
                            {customer?.name || "Customer"}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate italic">
                            {conversation?.lastMessage?.content || t("messages.noMessagesYet")}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[9px] font-bold text-gray-400">
                          {formatTime(conversation?.lastMessage?.createdAt)}
                        </span>
                        {conversation?.unreadCount > 0 && (
                          <span className="bg-green-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 flex flex-col overflow-hidden">
              {selectedConversation ? (
                <>
                  <div className="px-5 py-4 border-b bg-white">
                    <h3 className="font-black text-gray-800 uppercase tracking-tight text-sm">
                      {selectedConversation?.user?.name || "Customer"}
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 bg-[#f0f2f5]">
                    {selectedMessages.length > 0 ? (
                      selectedMessages.map((message, index) => {
                        const senderId = message?.sender?._id || message?.sender;
                        const isMe = senderId === userInfo?._id;

                        return (
                          <div
                            key={message?._id || index}
                            className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}
                          >
                            <div
                              className={`max-w-[75%] px-4 py-2 rounded-2xl font-medium text-[14px] shadow-sm ${
                                isMe
                                  ? "bg-green-600 text-white rounded-br-none"
                                  : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                              }`}
                            >
                              <p className="leading-relaxed">{message?.content}</p>
                              <p
                                className={`text-[9px] mt-1 font-bold uppercase tracking-tighter ${
                                  isMe ? "text-green-100" : "text-gray-400"
                                } text-right`}
                              >
                                {formatTime(message?.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400 font-bold text-xs uppercase tracking-widest">
                        {t("messages.noMessagesYet")}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t bg-white">
                    <form onSubmit={handleSendMessage} className="flex gap-3">
                      <input
                        type="text"
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
                        <FaPaperPlane size={16} />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <FaComments size={26} className="mb-3 text-green-300" />
                  <p className="font-bold uppercase text-xs tracking-widest">Select a conversation</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
              <FaComments size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-2">No Conversations Yet</h3>
            <p className="text-gray-500 font-bold text-sm max-w-xs mx-auto">Your customer messages will appear here.</p>
          </div>
        )
      ) : showFarmers ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
          {farmers && farmers.length > 0 ? (
            farmers.map((farmer) => (
              <div
                key={farmer._id}
                onClick={() => navigate(`/chat/${farmer._id}`)}
                className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-[2rem] hover:shadow-xl hover:border-green-200 cursor-pointer transition-all group"
              >
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center text-green-600 font-bold text-xl border-2 border-white shadow-sm group-hover:bg-green-500 group-hover:text-white transition-all">
                  {farmer.name?.charAt(0) || "F"}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black text-gray-800 tracking-tight">{farmer.name}</h4>
                    <FarmerVerificationBadge verified={Boolean(farmer?.verified_badge)} />
                  </div>
                  <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest">
                    {farmer.address || "Start a new chat"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">{t("messages.noFarmers")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 animate-fadeIn">
          {conversationList.length > 0 ? (
            conversationList.map((conversation, index) => (
              <MessageItem key={conversation.user?._id || conversation._id || index} conversation={conversation} />
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[2.5rem] shadow-sm border border-gray-100">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
                <FaComments size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-2">{t("messages.noMessagesTitle")}</h3>
              <p className="text-gray-500 font-bold text-sm max-w-xs mx-auto mb-8">{t("messages.noMessagesText")}</p>
              <button
                onClick={() => setShowFarmers(true)}
                className="bg-gray-900 text-white px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl"
              >
                {t("messages.findFarmers")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;

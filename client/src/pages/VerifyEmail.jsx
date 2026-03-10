import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { API_URL } from "../config/api";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // 'verifying', 'success', 'error'
  
  // 🚨 useRef use kiya hai taaki React StrictMode mein API call do baar na ho
  const hasCalled = useRef(false);

  useEffect(() => {
    const verifyToken = async () => {
      // 1. Double call protection
      if (hasCalled.current) return;
      
      // 2. Agar token URL mein nahi hai toh error dikhayein
      if (!token) {
        setStatus("error");
        return;
      }

      hasCalled.current = true;

      try {
        // 3. POST request: Backend router.post("/verify") se match karne ke liye
        const { data } = await axios.post(
          `${API_URL}/auth/verify`, 
          {}, // Empty body
          {
            headers: { Authorization: `Bearer ${token}` }, // Token Authorization header mein
          }
        );

        if (data.success) {
          setStatus("success");
          toast.success("Email Verified! Redirecting to login...");
          // 4. Success ke baad user ko result dikhane ke liye delay
          setTimeout(() => navigate("/login"), 3000);
        }
      } catch (error) {
        // 5. Detailed error logging debugging ke liye
        console.error("Verification API Error:", error.response?.data || error.message);
        setStatus("error");
        toast.error(error.response?.data?.message || "Verification Failed");
      }
    };

    verifyToken();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full p-10 bg-white shadow-2xl rounded-2xl text-center border border-gray-100">
        
        {/* State: Verifying */}
        {status === "verifying" && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-green-600 mx-auto"></div>
            <h2 className="text-2xl font-bold text-gray-800">Verifying Account</h2>
            <p className="text-gray-500">Your email is being verified, please wait...</p>
          </div>
        )}

        {/* State: Success */}
        {status === "success" && (
          <div className="space-y-4">
            <div className="flex items-center justify-center h-16 w-16 bg-green-100 text-green-600 rounded-full mx-auto text-3xl font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Verification Successful!</h2>
            <p className="text-gray-600 font-medium">Redirecting you to Login page...</p>
          </div>
        )}

        {/* State: Error */}
        {status === "error" && (
          <div className="space-y-4">
            <div className="flex items-center justify-center h-16 w-16 bg-red-100 text-red-600 rounded-full mx-auto text-3xl font-bold">
              ✕
            </div>
            <h2 className="text-2xl font-bold text-red-600">Oops! Verification Failed</h2>
            <p className="text-gray-500">The verification link is no longer valid. Please generate a new one.</p>
            <button 
              onClick={() => navigate("/login")}
              className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-all"
            >
              Go to Login
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default VerifyEmail;

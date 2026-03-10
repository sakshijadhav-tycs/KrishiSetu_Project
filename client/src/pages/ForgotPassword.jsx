import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { forgotPassword, resetPassword, clearError } from '../redux/slices/authSlice';
import { FaEnvelope, FaLock, FaKey, FaLeaf, FaArrowLeft } from 'react-icons/fa';
import { useEffect } from 'react';

const ForgotPassword = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { loading } = useSelector((state) => state.auth);

    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        dispatch(clearError());
    }, [dispatch]);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        const result = await dispatch(forgotPassword(email));
        if (result.meta.requestStatus === 'fulfilled') {
            setStep(2);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        const result = await dispatch(resetPassword({ email, otp, newPassword }));
        if (result.meta.requestStatus === 'fulfilled') {
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 p-10 rounded-2xl shadow-2xl bg-white border border-gray-100">
                <div className="text-center">
                    <FaLeaf className="mx-auto text-green-500 text-5xl animate-pulse" />
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900 font-serif">
                        {step === 1 ? 'Reset Password' : 'Verify Identity'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {step === 1
                            ? "Enter your registered email to receive a security code."
                            : `A 6-digit code has been sent to ${email}`}
                    </p>
                </div>

                {step === 1 ? (
                    <form className="mt-8 space-y-6" onSubmit={handleSendOTP}>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaEnvelope className="text-gray-400" />
                            </div>
                            <input
                                type="email"
                                required
                                className="pl-10 block w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent text-lg font-black rounded-xl text-white bg-green-600 hover:bg-green-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {loading ? 'Sending Code...' : 'Send Reset Link'}
                        </button>
                    </form>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
                        <div className="space-y-4">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FaKey className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    maxLength="6"
                                    className="pl-10 block w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                    placeholder="6-Digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                />
                            </div>

                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FaLock className="text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="pl-10 block w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                    placeholder="Create New Password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent text-lg font-black rounded-xl text-white bg-green-600 hover:bg-green-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep(1);
                                dispatch(clearError());
                            }}
                            className="w-full flex items-center justify-center text-sm text-gray-500 hover:text-green-600 transition-colors"
                        >
                            <FaArrowLeft className="mr-2" /> Change Email
                        </button>
                    </form>
                )}

                <div className="text-center mt-4">
                    <Link to="/login" className="text-sm font-bold text-green-600 hover:text-green-800 underline">
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;

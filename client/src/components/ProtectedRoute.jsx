import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ allowedRoles }) => {
  const { token, userInfo, isLoaded } = useSelector((state) => state.auth);
  const location = useLocation();

  // Agar auth state abhi load ho rahi hai, toh kuch mat dikhao (ya Loader dikhao)
  if (!isLoaded) return null; 

  // 1. Agar token nahi hai, toh login par bhejo
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Agar role allowed nahi hai, toh Home ya Unauthorised page par bhejo
  if (allowedRoles && !allowedRoles.includes(userInfo?.role)) {
    return <Navigate to="/" replace />;
  }

  // 3. Agar sab sahi hai, toh page (Outlet) dikhao
  return <Outlet />;
};

export default ProtectedRoute;
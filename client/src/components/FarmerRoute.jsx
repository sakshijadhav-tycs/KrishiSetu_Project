import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Loader from './Loader'; // Pakka karein ki Loader.jsx isi folder mein hai

const FarmerRoute = () => {
  // Redux se data lein
  const { userInfo, isAuthenticated, isLoaded } = useSelector((state) => state.auth);

  /**
   * 🚨 Loop Fix Logic:
   * Jab tak 'isLoaded' false hai, iska matlab loadUser() abhi server se 
   * session confirm kar raha hai. Tab tak redirect mat karo.
   */
  if (!isLoaded && isAuthenticated) {
    return <Loader />; 
  }

  // Agar user login hai aur uska role 'farmer' hai, toh hi aage jane dein
  return isAuthenticated && userInfo?.role === 'farmer' 
    ? <Outlet /> 
    : <Navigate to="/login" replace />;
};

export default FarmerRoute;
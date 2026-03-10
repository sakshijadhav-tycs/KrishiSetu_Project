import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import Loader from "./Loader";

const PrivateRoute = () => {
  const { isAuthenticated, loading } = useSelector((state) => state.auth);

  // Show loader while auth state is being checked
  if (loading) {
    return <Loader />;
  }

  // If logged in → allow access
  // If not logged in → redirect to login
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace />
  );
};

export default PrivateRoute;

import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BackButton from "./BackButton";

const Layout = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const hideBackButtonPaths = new Set([
    "/",
    "/about",
    "/login",
    "/register",
    "/forgot-password",
    "/verify-email",
    "/consumer/dashboard",
    "/consumer/dashboard/",
    "/farmer/dashboard",
    "/farmer/dashboard/",
  ]);
  const shouldShowBackButton = !isAdminRoute && !hideBackButtonPaths.has(location.pathname);

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      {!isAdminRoute && <Navbar />}
      <main className="flex-grow bg-white dark:bg-gray-900">
        {shouldShowBackButton && (
          <div className="container mx-auto px-4 pt-4">
            <BackButton />
          </div>
        )}
        <Outlet />
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
};

export default Layout;

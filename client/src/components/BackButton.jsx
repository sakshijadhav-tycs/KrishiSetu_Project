import { FaArrowLeft } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";

const getFallbackPath = (pathname = "") => {
  if (pathname.startsWith("/admin")) return "/admin/dashboard";
  if (pathname.startsWith("/farmer")) return "/farmer/dashboard";
  if (pathname.startsWith("/consumer")) return "/consumer/dashboard";
  return "/";
};

const BackButton = ({ fallbackTo, className = "" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const resolvedFallback = fallbackTo || getFallbackPath(location.pathname);

  const handleBack = () => {
    const historyIndex = Number(window.history?.state?.idx ?? 0);
    if (historyIndex > 0) {
      navigate(-1);
      return;
    }
    navigate(resolvedFallback, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2 text-sm font-semibold text-green-800 shadow-sm transition hover:bg-green-200 hover:shadow ${className}`}
    >
      <FaArrowLeft size={12} />
      Back
    </button>
  );
};

export default BackButton;

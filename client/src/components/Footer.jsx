import { Link } from "react-router-dom";
import {
  FaLeaf,
  FaEnvelope,
  FaPhone,
  FaLocationDot,
  FaInstagram,
  FaFacebookF,
  FaXTwitter,
  FaLinkedinIn,
} from "react-icons/fa6";
const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-b from-green-950 to-emerald-950 text-emerald-50 pt-12 pb-6">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FaLeaf className="text-emerald-300 text-2xl" />
              <h3 className="text-xl font-bold">कृषीSetu</h3>
            </div>
            <p className="text-emerald-100/80 text-sm leading-6">
              Rooted in Soil, Connected by Technology
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-3">About</h3>
            <p className="text-sm text-emerald-100/80 leading-6">
              Connecting local farms and families with trusted produce, fair pricing, and transparent delivery.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-3">{t("footer.quickLinks")}</h3>
            <ul className="space-y-2 text-sm text-emerald-100/80">
              <li><Link to="/" className="hover:text-white">{t("navbar.home")}</Link></li>
              <li><Link to="/products" className="hover:text-white">{t("footer.products")}</Link></li>
              <li><Link to="/farmers" className="hover:text-white">{t("navbar.farmers")}</Link></li>
              <li><Link to="/about" className="hover:text-white">{t("footer.about")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Contact Information</h3>
            <p className="flex gap-2 items-start text-sm text-emerald-100/80 mb-2">
              <FaLocationDot /> Nadhwal, Satara, Maharashtra, India
            </p>
            <p className="flex gap-2 items-center text-sm text-emerald-100/80 mb-2">
              <FaPhone /> +91 8779862902
            </p>
            <p className="flex gap-2 items-center text-sm text-emerald-100/80 mb-4">
              <FaEnvelope /> support@krushisetu.com
            </p>
            <div className="flex gap-2">
              <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <FaInstagram size={14} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <FaFacebookF size={14} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <FaXTwitter size={14} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <FaLinkedinIn size={14} />
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-emerald-100/70 text-xs mt-10 border-t border-white/10 pt-4">
          © {year} कृषीSetu. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
};

export default Footer;

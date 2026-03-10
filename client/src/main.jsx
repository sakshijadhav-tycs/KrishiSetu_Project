import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { io } from "socket.io-client";
import App from "./App";
import { store } from "./redux/store";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";
import "./i18n";
import { initTranslation } from "./utils/autoTranslate";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";

// Initialize automatic translation
initTranslation();


// Make socket.io available globally for testing
window.io = io;


// Note: Removed ToastContainer and CSS import because we are using 
// react-hot-toast inside the App component for better global control.

const storedUser = localStorage.getItem("userInfo");
let parsedUser = null;
try {
  parsedUser = storedUser ? JSON.parse(storedUser) : null;
} catch {
  parsedUser = null;
}
const userThemeKey = parsedUser?._id ? `theme:${parsedUser._id}` : "";
const initialTheme =
  localStorage.getItem(userThemeKey) || localStorage.getItem("theme");
const resolvedTheme = ["dark", "light"].includes(initialTheme)
  ? initialTheme
  : window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
document.documentElement.setAttribute("data-theme", resolvedTheme);

/**
 * Root component that applies the renderKey from LanguageContext.

 * This key changes whenever the language is switched, forcing a 
 * complete "clean" re-render of the app without a full browser reload.
 */
const RootApp = () => {
  const { renderKey } = useLanguage();
  return (
    <div key={renderKey}>
      <App />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <LanguageProvider>
          <BrowserRouter>
            <RootApp />
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);


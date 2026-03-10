import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

const ThemeContext = createContext(null);
const GLOBAL_THEME_KEY = "theme";
const normalizeTheme = (value) =>
  value === "dark" || value === "light" ? value : null;
const getUserThemeKey = (userId) => (userId ? `theme:${userId}` : "");

const getPreferredTheme = (userId = "") => {
  if (typeof window === "undefined") return "light";
  const userThemeKey = getUserThemeKey(userId);
  const perUserTheme = normalizeTheme(localStorage.getItem(userThemeKey));
  if (perUserTheme) {
    return perUserTheme;
  }
  const savedTheme = normalizeTheme(localStorage.getItem(GLOBAL_THEME_KEY));
  if (savedTheme) {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const ThemeProvider = ({ children }) => {
  const { userInfo } = useSelector((state) => state.auth || {});
  const userId = userInfo?._id ? String(userInfo._id) : "";
  const [theme, setTheme] = useState(() => getPreferredTheme(userId));

  useEffect(() => {
    const resolvedTheme = getPreferredTheme(userId);
    setTheme((prev) => (prev === resolvedTheme ? prev : resolvedTheme));
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
    localStorage.setItem(GLOBAL_THEME_KEY, theme);
    const userThemeKey = getUserThemeKey(userId);
    if (userThemeKey) {
      localStorage.setItem(userThemeKey, theme);
    }
  }, [theme, userId]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isDark: theme === "dark",
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

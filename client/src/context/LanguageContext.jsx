import React, { createContext, useContext, useState, useEffect } from "react";
import { setLanguage as setAutoLanguage, resetLanguage as resetAutoLanguage, initTranslation } from "../utils/autoTranslate";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(localStorage.getItem("language") || "en");
  const [renderKey, setRenderKey] = useState(0); // Used to force-refresh the app tree

  useEffect(() => {
    // Initialize translation on mount
    initTranslation();
  }, []);

  const changeLanguage = (langCode) => {
    if (langCode === language) return;
    
    // 1. Update localStorage and internal service state
    setAutoLanguage(langCode);
    
    // 2. Update React state
    setLanguageState(langCode);
    
    // 3. Increment renderKey to force a "clean" re-render of the app
    // This allows the autoTranslate service to work on fresh English nodes
    setRenderKey(prev => prev + 1);
  };

  const resetLanguage = () => {
    resetAutoLanguage();
    setLanguageState("en");
    setRenderKey(prev => prev + 1);
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, resetLanguage, renderKey }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

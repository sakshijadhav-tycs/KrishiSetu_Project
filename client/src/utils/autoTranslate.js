/**
 * Global Automatic Translation Service (autoTranslate.js)
 * Transforms English DOM text nodes into Hindi or Marathi dynamically.
 * Uses a public translation API, localStorage caching, and MutationObserver.
 */

const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr'];
const TRANSLATION_CACHE_KEY = 'krishisetu_translations_v2';
const SELECTED_LANGUAGE_KEY = 'language';

// Internal map for high-frequency UI elements to ensure instant "no-flicker" translation
const BASE_TRANSLATION_MAP = {
  hi: {
    "Home": "मुख्यपृष्ठ",
    "Market": "बाजार",
    "Farmers": "किसान",
    "Login": "लॉगिन",
    "Join": "जुड़ें",
    "Join Us": "हमसे जुड़ें",
    "All Products": "सभी उत्पाद",
    "Admin Panel": "एडमिन पैनल",
    "Farmer Dashboard": "किसान डैशबोर्ड",
    "My Dashboard": "मेरा डैशबोर्ड",
    "Settings": "सेटिंग्स",
    "Sign Out": "साइन आउट",
    "Shop Now": "अभी खरीदें",
    "Meet Farmers": "किसानों से मिलें",
    "Fresh from Farmers": "किसानों से ताजा",
    "Direct to Your Home": "सीधे आपके घर",
    "About": "के बारे में",
    "My Orders": "मेरे आदेश",
  },
  mr: {
    "Home": "मुख्यपृष्ठ",
    "Market": "बाजार",
    "Farmers": "शेतकरी",
    "Login": "लॉगिन",
    "Join": "सहभागी व्हा",
    "Join Us": "आमच्याशी जोडा",
    "All Products": "सर्व उत्पादने",
    "Admin Panel": "एडमिन पॅनेल",
    "Farmer Dashboard": "शेतकरी डॅशबोर्ड",
    "My Dashboard": "माझा डॅशबोर्ड",
    "Settings": "सेटिंग्ज",
    "Sign Out": "साइन आउट",
    "Shop Now": "आता खरेदी करा",
    "Meet Farmers": "शेतकऱ्यांना भेटा",
    "Fresh from Farmers": "शेतकऱ्यांकडून ताजे",
    "Direct to Your Home": "थेट तुमच्या घरी",
    "About": "बद्दल",
    "My Orders": "माझ्या ऑर्डर",
  }
};

let currentLang = localStorage.getItem(SELECTED_LANGUAGE_KEY) || 'en';
let translationCache = JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY)) || { hi: {}, mr: {} };

/**
 * Saves the current cache to localStorage.
 */
const saveCache = () => {
  localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(translationCache));
};

/**
 * Fetches translation from a public API.
 * Uses a common trick for client-side translation without an API key.
 * @param {string} text 
 * @param {string} targetLang 
 * @returns {Promise<string>}
 */
const fetchTranslation = async (text, targetLang) => {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    return data[0][0][0];
  } catch (error) {
    console.warn("Translation failed for:", text, error);
    return text; // Fallback to original
  }
};

/**
 * Translates a single text node.
 * @param {Node} node 
 */
const translateNode = async (node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    if (!text || text.length < 2) return;

    // Skip if it's already in the target language (rough check) or is a number
    if (/^[\d.,\s%₹/-]+$/.test(text)) return;
    if (currentLang === 'en') return;

    // 1. Check Base Map (Instant)
    const baseMatch = BASE_TRANSLATION_MAP[currentLang][text];
    if (baseMatch) {
      node.textContent = node.textContent.replace(text, baseMatch);
      return;
    }

    // 2. Check Cache
    if (translationCache[currentLang][text]) {
      node.textContent = node.textContent.replace(text, translationCache[currentLang][text]);
      return;
    }

    // 3. Fetch from API
    const translatedText = await fetchTranslation(text, currentLang);
    if (translatedText && translatedText !== text) {
      translationCache[currentLang][text] = translatedText;
      saveCache();
      // Update node text (ensure we don't overwrite if text changed in between)
      if (node.textContent.trim() === text) {
          node.textContent = node.textContent.replace(text, translatedText);
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const tagName = node.tagName.toLowerCase();
    if (['script', 'style', 'textarea', 'code', 'noscript'].includes(tagName)) return;

    // Translate placeholder
    if (node.placeholder && currentLang !== 'en') {
      const placeholder = node.placeholder.trim();
      if (translationCache[currentLang][placeholder]) {
        node.placeholder = translationCache[currentLang][placeholder];
      } else {
        fetchTranslation(placeholder, currentLang).then(translated => {
            if (translated) {
                translationCache[currentLang][placeholder] = translated;
                saveCache();
                node.placeholder = translated;
            }
        });
      }
    }

    // Recursively check children
    node.childNodes.forEach(translateNode);
  }
};

/**
 * Scans the entire body and translates visible text.
 */
export const translateDOM = () => {
  if (currentLang === 'en') return;
  translateNode(document.body);
};

/**
 * Sets the current language and triggers re-translation.
 * @param {string} lang 
 */
export const setLanguage = (lang) => {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem(SELECTED_LANGUAGE_KEY, lang);
  
  if (lang !== 'en') {
    translateDOM();
  }
};

export const getCurrentLanguage = () => currentLang;

/**
 * Resets the language to English and clears from storage.
 */
export const resetLanguage = () => {
  localStorage.removeItem(SELECTED_LANGUAGE_KEY);
  currentLang = 'en';
};



/**
 * Initializes the translation service and sets up MutationObserver.
 */
export const initTranslation = () => {
  if (currentLang !== 'en') {
    translateDOM();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(node => {
            // Delay slightly to ensure content is fully rendered
            setTimeout(() => translateNode(node), 50);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
};

export const languageService = {
  setLanguage,
  getCurrentLanguage,
  resetLanguage,
  initTranslation,
  translateDOM
};

export default languageService;


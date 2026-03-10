/**
 * Simplified Global i18n Helper
 * Replaces react-i18next hooks and provides a global 't' function.
 * This file embeds the core English mapping to ensure the UI renders correctly
 * before the autoTranslate.js service scans and translates the DOM.
 */

const englishMapping = {
  "navbar.home": "Home",
  "navbar.market": "Market",
  "navbar.farmers": "Farmers",
  "navbar.login": "Login",
  "navbar.join": "Join",
  "navbar.joinUs": "Join Us",
  "navbar.allProducts": "All Products",
  "navbar.adminPanel": "Admin Panel",
  "navbar.farmerDashboard": "Farmer Dashboard",
  "navbar.consumerDashboard": "My Dashboard",
  "navbar.settings": "Settings",
  "navbar.signOut": "Sign Out",
  "hero.title": "Welcome to KrishiSetu",
  "hero.subtitle": "A bridge between farmers and consumers for fresh, local and affordable produce.",
  "hero.shopNow": "Shop Now",
  "hero.meetFarmers": "Meet Farmers",
  "features.whyChoose": "Why Choose KrishiSetu?",
  "features.freshLocalTitle": "Fresh & Local",
  "features.freshLocalDesc": "Directly sourced from nearby farms",
  "features.supportFarmersTitle": "Support Farmers",
  "features.supportFarmersDesc": "Fair pricing for hardworking farmers",
  "features.seasonalProduceTitle": "Seasonal Produce",
  "features.seasonalProduceDesc": "Healthy & chemical-free products",
  "features.directConnectionTitle": "Direct Connection",
  "features.directConnectionDesc": "Know who grows your food",
  "home.featuredProducts": "Featured Products",
  "home.viewAll": "View All →",
  "home.loginToSeeProducts": "Log in to see our latest farm-fresh products.",
  "home.loginNow": "Login Now",
  "home.browseByCategory": "Browse by Category",
  "home.loginToExploreCategories": "Log in to explore categories.",
  "home.categoriesComingSoon": "Categories coming soon.",
  "home.ourFarmers": "Our Farmers",
  "home.loginToConnectFarmers": "Log in to connect with farmers.",
  "home.noFarmers": "No farmers available at the moment.",
  "auth.login.title": "Sign In",
  "auth.login.submit": "Sign In",
  "auth.register.title": "Create your account",
  "auth.register.submit": "Create Account",
  "products.browseTitle": "Browse Products",
  "products.searchPlaceholder": "Search fresh produce...",
  "products.pricePerUnit": "per {{unit}}",
  "products.buyNow": "Buy Now",
  "products.addToCart": "Add To Cart",
  "products.outOfStock": "Out of Stock",
  "products.loginToAdd": "Please log in to add this product to your cart.",
  "products.addedToCart": "{{name}} added to cart.",
  "products.detailsUnavailable": "Product details are unavailable right now.",
  "products.goBackShopLink": "Go back to shop",
  "cart.header": "My Shopping Bag",
  "cart.itemsLabel": "Items",
  "cart.emptyTitle": "Your cart is empty",
  "cart.emptySubtitle": "Add fresh products from the marketplace to get started.",
  "cart.removeItemTitle": "Remove item",
  "cart.checkout": "Checkout",
  "dashboard.greeting": "Namaste, {{name}}!",
  "dashboard.navOrderHistory": "Order History",
  "dashboard.navMyMessages": "My Messages",
  "messages.pageTitle": "Inbox",
  "messages.inboxTagline": "Manage all your conversations in one place.",
  "messages.startNewTitle": "Start New Chat",
  "messages.back": "Back",
  "messages.newChat": "New Chat",
  "messages.noMessagesYet": "No messages yet",
  "messages.noMessagesTitle": "No conversations yet",
  "messages.noMessagesText": "Start a new conversation to connect with farmers and buyers.",
  "dashboard.navMyProfile": "My Profile",
  "farmerDashboard.title": "Farmer Dashboard",
  "farmerDashboard.welcome": "Welcome, {{name}}",
  "farmerDashboard.addProductCta": "Add Product Category",
  "profile.title": "My Profile",
  "profile.kycStatusLabel": "KYC Status:",
  "profile.kycNone": "None",
  "profile.tabGeneral": "General",
  "profile.tabFarm": "Farm",
  "profile.tabKyc": "KYC",
  "profile.fullName": "Full Name",
  "profile.emailAddress": "Email Address",
  "profile.phoneNumber": "Phone Number",
  "profile.role": "Role",
  "profile.roleUser": "User",
  "profile.addressDetails": "Address Details",
  "profile.streetPlaceholder": "Street Address",
  "profile.cityPlaceholder": "City",
  "profile.statePlaceholder": "State",
  "profile.updateInfo": "Update Info",
  "footer.about": "About",
  "tutorial.howToUse": "How to Use"
};

/**
 * Global translation function.
 * Handles both plain keys and interpolation templates.
 */
window.t = (key, options = {}) => {
  let text = englishMapping[key] || key.split('.').pop().replace(/([A-Z])/g, ' $1').trim();
  
  if (options && typeof options === 'object') {
    Object.keys(options).forEach(param => {
      text = text.replace(`{{${param}}}`, options[param]);
    });
  }
  return text;
};

// Also mock i18n object for components that might still reference it (e.g. for language code)
window.i18n = {
  language: localStorage.getItem('language') || 'en',
  changeLanguage: (lang) => {
    window.i18n.language = lang;
    localStorage.setItem('language', lang);
  }
};

export default window.t;

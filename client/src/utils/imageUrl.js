export const resolveImageUrl = (rawValue, backendUrl) => {
  if (!rawValue) return "";

  const value = String(rawValue).trim().replace(/\\/g, "/");
  if (!value) return "";

  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }

  const base = String(backendUrl || "").replace(/\/+$/, "");
  if (!base) return value.startsWith("/") ? value : `/${value}`;

  // Handle absolute filesystem paths that include /uploads/... on Windows/Linux
  const uploadsIndex = value.toLowerCase().lastIndexOf("/uploads/");
  if (uploadsIndex >= 0) {
    return `${base}${value.slice(uploadsIndex)}`;
  }

  const normalized = value.startsWith("/") ? value : `/${value}`;
  return `${base}${normalized}`;
};


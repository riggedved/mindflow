const RAW_BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const API_BASE_URL = RAW_BACKEND_URL.replace(/\/$/, "");
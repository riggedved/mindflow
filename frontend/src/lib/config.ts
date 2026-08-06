const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://mindflow-backend-qsmf.onrender.com";

export const API_BASE_URL = RAW_BACKEND_URL.replace(/\/$/, "");

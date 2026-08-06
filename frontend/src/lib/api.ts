import { authStorage } from "./auth";
import { API_BASE_URL } from "./config";

export async function apiRequest(
  endpoint: string,
  method: string = "GET",
  body?: any,
  token?: string
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Use provided token or get from storage
  const authToken = token || authStorage.getToken();
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // Include cookies for OAuth
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "API request failed" }));

    let message = "API request failed";
    if (error) {
      const detail = error.detail ?? error.message;
      if (Array.isArray(detail)) {
        message = detail
          .map((entry: any) => {
            const msg = entry?.msg || entry?.message;
            if (msg === "String should have at least 8 characters") {
              return "Password must be at least 8 characters";
            }
            return msg;
          })
          .filter(Boolean)
          .join(", ") || message;
      } else if (typeof detail === "string") {
        message = detail === "String should have at least 8 characters"
          ? "Password must be at least 8 characters"
          : detail;
      }
    }

    if (response.status === 401 && authToken) {
      // Token-based request failed; treat as expired session
      authStorage.clear();
      window.location.href = "/auth/login";
      throw new Error("Session expired. Please sign in again.");
    }

    throw new Error(message || "Request failed");
  }

  return response.json();
}

// Normalize item objects returned from the backend into the frontend shape we expect.
export function normalizeItem(item: any) {
  if (!item) return item;
  const preview = item.preview || item.ai_meta?.preview || null;
  const sourceUrl = item.source_url || item.sourceUrl || item.url || item.ai_meta?.source_url || "";
  const spaceId = item.space_id ?? item.spaceId ?? item.space?.id ?? null;
  return {
    ...item,
    sourceUrl,
    preview,
    // backend may return raw_content for stored media or content/url for older items
    content: (preview && preview.value) || item.raw_content || item.content || item.url || "",
    // description may be provided directly or stored inside ai_meta.description
    description: item.description ?? item.ai_meta?.description ?? item.title ?? "",
    // ensure tags exists
    tags: item.tags || [],
    spaceId,
  };
}

export function normalizeItems(items: any[]) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeItem);
}

// API helper object with common HTTP methods
export const api = {
  get: (endpoint: string) => apiRequest(endpoint, "GET"),
  post: (endpoint: string, body?: any) => apiRequest(endpoint, "POST", body),
  put: (endpoint: string, body?: any) => apiRequest(endpoint, "PUT", body),
  delete: (endpoint: string) => apiRequest(endpoint, "DELETE"),
  patch: (endpoint: string, body?: any) => apiRequest(endpoint, "PATCH", body),
};

// Multipart upload helper (no JSON Content-Type)
export async function apiUpload(
  endpoint: string,
  formData: FormData,
  token?: string
) {
  const headers: Record<string, string> = {};
  const authToken = token || authStorage.getToken();
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

    if (!response.ok) {
    if (response.status === 401) {
      authStorage.clear();
      window.location.href = "/auth/login";
      throw new Error("Session expired. Please sign in again.");
    }
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }

  return response.json();
}

export const apiEx = {
  ...api,
  upload: (endpoint: string, formData: FormData) => apiUpload(endpoint, formData),
};

import axios from "axios";

const baseURL = "http://localhost:5000/api";
const REFRESH_KEY = "bizassist:refresh";

const api = axios.create({
  baseURL,
  // Local models can take a while to answer the first time they are loaded.
  timeout: 90000
});

const AUTH_ENDPOINTS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password"
];

const isAuthEndpoint = (url = "") => AUTH_ENDPOINTS.some((path) => url.includes(path));

let refreshPromise = null;

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem(REFRESH_KEY);

  if (!refreshToken) throw new Error("No refresh token");

  // Use the bare client so this request cannot loop through the interceptor.
  const { data } = await axios.post(
    `${baseURL}/auth/refresh`,
    { refreshToken },
    { timeout: 15000, headers: { "Content-Type": "application/json" } }
  );

  if (!data?.token || !data?.refreshToken) {
    throw new Error("Refresh response was incomplete");
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);

  return data.token;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * On a 401, try the rotating refresh token once before giving up. If the
 * refresh also fails the stored session is cleared through AuthContext.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config || {};
    const url = original.url || "";

    if (status !== 401) return Promise.reject(error);

    if (isAuthEndpoint(url) || original._retriedWithRefresh || original.skipAuthRefresh) {
      if (!isAuthEndpoint(url)) {
        window.dispatchEvent(new Event("bizassist:unauthorized"));
      }
      return Promise.reject(error);
    }

    original._retriedWithRefresh = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const token = await refreshPromise;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;

      return api(original);
    } catch {
      window.dispatchEvent(new Event("bizassist:unauthorized"));
      return Promise.reject(error);
    }
  }
);

/** Turn any axios failure into a message that is safe to show in the UI. */
export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === "ERR_NETWORK") {
    return "Cannot reach the server. Check that the API is running on port 5000.";
  }
  if (error?.code === "ECONNABORTED") return "The request timed out. Please try again.";
  return error?.message || fallback;
};

export default api;

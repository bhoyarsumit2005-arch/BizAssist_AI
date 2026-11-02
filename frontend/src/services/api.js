import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// A 401 from any non-auth endpoint means the stored session is no longer
// valid. AuthContext listens for this event and clears the session.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/register");

    if (status === 401 && !isAuthCall) {
      window.dispatchEvent(new Event("bizassist:unauthorized"));
    }

    return Promise.reject(error);
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

import axios, { AxiosHeaders } from "axios";
import { API_BASE_URL } from "../config/apiConfig";

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  maxContentLength: 50 * 1024 * 1024,
  maxBodyLength: 50 * 1024 * 1024
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = AxiosHeaders.from(config.headers);
    config.headers.set("Authorization", `Bearer ${authToken}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

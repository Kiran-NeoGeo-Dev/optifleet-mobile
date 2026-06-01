import axios, { AxiosHeaders } from "axios";
import { API_BASE_URL } from "../config/apiConfig";

console.log("=== API CONFIG ===");
console.log("API_BASE_URL:", API_BASE_URL);

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  maxContentLength: 50 * 1024 * 1024,
  maxBodyLength: 50 * 1024 * 1024
});

api.interceptors.request.use((config) => {
  console.log("HTTP REQUEST:", config.method?.toUpperCase(), config.baseURL + config.url);
  if (authToken) {
    config.headers = AxiosHeaders.from(config.headers);
    config.headers.set("Authorization", `Bearer ${authToken}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log("HTTP RESPONSE:", response.status, response.config.url);
    return response;
  },
  (error) => {
    console.log("HTTP ERROR:", error?.response?.status, error?.config?.url, error?.message);
    return Promise.reject(error);
  }
);

import { api } from "./api";
import { ENDPOINTS, API_BASE_URL } from "../config/apiConfig";
import { Client } from "../types/Client";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  clientId: number;
  username: string;
  role: string;
}

export const login = async (payload: LoginRequest) => {
  console.log("=== LOGIN DEBUG ===");
  console.log("URL:", API_BASE_URL + ENDPOINTS.LOGIN);
  console.log("Payload:", JSON.stringify(payload));
  try {
    const res = await api.post<LoginResponse>(ENDPOINTS.LOGIN, payload);
    console.log("LOGIN SUCCESS:", JSON.stringify(res.data));
    return res.data;
  } catch (err: any) {
    console.log("LOGIN ERROR status:", err?.response?.status);
    console.log("LOGIN ERROR data:", JSON.stringify(err?.response?.data));
    console.log("LOGIN ERROR message:", err?.message);
    console.log("LOGIN ERROR code:", err?.code);
    throw err;
  }
};

export const fetchForgotPasswordMessage = async () => {
  const res = await api.get<string>(ENDPOINTS.FORGOT_PASSWORD_MESSAGE);
  return res.data;
};

export const fetchClientDetails = async () => {
  const res = await api.get<Client>(ENDPOINTS.CLIENT_DETAILS);
  return res.data;
};

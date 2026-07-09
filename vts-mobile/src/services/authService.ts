import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";
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
  const res = await api.post<LoginResponse>(ENDPOINTS.LOGIN, payload);
  return res.data;
};

export const fetchForgotPasswordMessage = async () => {
  const res = await api.get<string>(ENDPOINTS.FORGOT_PASSWORD_MESSAGE);
  return res.data;
};

export const fetchClientDetails = async () => {
  const res = await api.get<Client>(ENDPOINTS.CLIENT_DETAILS);
  return res.data;
};

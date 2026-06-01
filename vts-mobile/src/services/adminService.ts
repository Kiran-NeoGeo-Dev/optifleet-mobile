import { api } from "./api";

export interface CreateClientPayload {
  username:        string;
  password:        string;
  fullName:        string;
  emailAddress:    string;
  phoneNumber:     string;
  role:            string;
  roleDescription: string;
}

export const createClientAccount = async (payload: CreateClientPayload) => {
  const res = await api.post("/api/auth/create-client", payload);
  return res.data;
};

export const fetchAllClients = async () => {
  const res = await api.get<{ client_id: number; full_name: string; username: string; role: string }[]>("/api/auth/all-clients");
  return res.data;
};

export const fetchAllDriversAdmin = async () => {
  const res = await api.get("/api/drivers");
  return res.data;
};

export const fetchAllVehiclesAdmin = async () => {
  const res = await api.get("/api/vehicles");
  return res.data;
};

export interface UserDetail {
  client_id:           number;
  username:            string;
  full_name:           string;
  email_address:       string;
  phone_number:        string;
  dial_code:           string;
  role:                string;
  role_description:    string;
  created_at:          string;
  created_by_admin_id: number | null;
}

export interface UpdateUserPayload {
  fullName:        string;
  emailAddress:    string;
  phoneNumber:     string;
  dialCode:        string;
  role:            string;
  roleDescription: string;
  newUsername?:    string;
  newPassword?:    string;
}

export const fetchAllUsers = async (): Promise<UserDetail[]> => {
  const res = await api.get<UserDetail[]>("/api/auth/all-users");
  return res.data;
};

export const fetchUser = async (clientId: number): Promise<UserDetail> => {
  const res = await api.get<UserDetail>(`/api/auth/users/${clientId}`);
  return res.data;
};

export const updateUser = async (clientId: number, payload: UpdateUserPayload) => {
  const res = await api.put(`/api/auth/users/${clientId}`, payload);
  return res.data;
};

export const deleteUser = async (clientId: number) => {
  const res = await api.delete(`/api/auth/users/${clientId}`);
  return res.data;
};

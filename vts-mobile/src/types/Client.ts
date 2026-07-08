export interface Client {
  clientId: number;
  username: string;
  fullName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  role?: string;
  roleDescription?: string;
}

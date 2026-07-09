export interface Driver {
  id: number;
  driverName: string;
  phoneNumber?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  aadharNumber?: string;
  status: boolean;
  comments?: string;
  username?: string;
  password?: string;
  clientId?: number;
  frontFaceImage?: string;
  leftFaceImage?: string;
  rightFaceImage?: string;
}

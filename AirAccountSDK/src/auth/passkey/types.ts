export interface PasskeyRegistrationParams {
  email: string;
  username: string;
  password?: string;
}

export interface PasskeyAuthenticationParams {
  email?: string;
}

export interface TransactionVerificationParams {
  to: string;
  value?: string;
  data?: string;
}

export interface PasskeyInfo {
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  createdAt: string;
}

// Backend API Interfaces
export interface BeginRegistrationResponse {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: any[];
  timeout?: number;
  authenticatorSelection?: any;
  attestation?: string;
}

export interface BeginAuthenticationResponse {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: any[];
  userVerification?: string;
}

export interface BeginTransactionVerificationResponse extends BeginAuthenticationResponse {
  userOpHash: string;
}

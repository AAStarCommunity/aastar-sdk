/**
 * AirAccount SDK - Basic Usage Example (Browser/Frontend)
 *
 * This example demonstrates how to integrate the AirAccount SDK
 * into your frontend application for Passkey authentication and
 * KMS-based wallet operations with ERC-4337 account abstraction.
 */

import { YAAAClient } from "@yaaa/sdk";

// ============================================
// 1. Initialize the SDK Client
// ============================================

const yaaa = new YAAAClient({
  // Your backend API URL
  apiURL: "http://localhost:3000/api/v1",

  // Token provider function (for authenticated requests)
  tokenProvider: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  },

  // BLS configuration
  bls: {
    seedNodes: ["https://signer1.aastar.io", "https://signer2.aastar.io"],
    discoveryTimeout: 5000,
  },
});

// ============================================
// 2. KMS-Based Passkey Registration
// ============================================

/**
 * Registration flow (KMS + WebAuthn):
 * 1. Backend calls KMS BeginRegistration
 * 2. Browser triggers WebAuthn biometric prompt
 * 3. Backend calls KMS CompleteRegistration
 * 4. KMS creates a signing key linked to the passkey
 * 5. Backend returns JWT + user info
 */
async function registerWithPasskey() {
  try {
    console.log("Starting KMS-backed Passkey registration...");

    const result = await yaaa.passkey.register({
      email: "user@example.com",
      username: "JohnDoe",
    });

    console.log("Registration successful!");
    console.log("User:", result.user);
    console.log("Token:", result.token);

    // Save token for future requests
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));

    return result;
  } catch (error) {
    console.error("Registration failed:", error);
    throw error;
  }
}

// ============================================
// 3. KMS Passkey Login
// ============================================

/**
 * Login flow (KMS + WebAuthn):
 * 1. Backend calls KMS BeginAuthentication
 * 2. Browser triggers WebAuthn biometric prompt
 * 3. Backend verifies credential via KMS
 * 4. Backend returns JWT token
 */
async function loginWithPasskey() {
  try {
    console.log("Starting KMS-backed Passkey login...");

    const result = await yaaa.passkey.authenticate();

    console.log("Login successful!");
    console.log("User:", result.user);

    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));

    return result;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
}

// ============================================
// 4. Transaction with Passkey Assertion
// ============================================

/**
 * Transaction flow (KMS signing):
 * 1. User confirms via biometric (WebAuthn assertion)
 * 2. Assertion is sent to backend with transfer params
 * 3. Backend uses KMS to sign the UserOp with the passkey assertion
 * 4. Signed UserOp submitted to bundler
 *
 * Note: The `passkeyAssertion` field uses the Legacy format
 * with AuthenticatorData, ClientDataHash, and Signature.
 */
async function sendTransaction() {
  try {
    console.log("Preparing transaction...");

    // Step 1: Verify transaction with Passkey (gets WebAuthn credential)
    const verification = await yaaa.passkey.verifyTransaction({
      to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      value: "0.01",
      data: "0x",
    });

    console.log("Transaction verified!");
    console.log("UserOpHash:", verification.userOpHash);

    // Step 2: Send the verified transaction to your backend
    // The backend will construct and sign the UserOp via KMS
    const response = await fetch("http://localhost:3000/api/v1/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        amount: "0.01",
        // KMS passkey assertion format (Legacy hex format for BLS dual-signing)
        passkeyAssertion: {
          AuthenticatorData: verification.credential.authenticatorData,
          ClientDataHash: verification.credential.clientDataHash,
          Signature: verification.credential.signature,
        },
        usePaymaster: true,
      }),
    });

    const result = await response.json();
    console.log("Transaction submitted:", result);

    return result;
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
}

// ============================================
// 5. BLS Signature Operations (Advanced)
// ============================================

async function demonstrateBLS() {
  try {
    // Get available BLS nodes from gossip network
    const nodes = await yaaa.bls.getAvailableNodes();
    console.log("Available BLS nodes:", nodes);

    // Generate message point for a UserOpHash
    const userOpHash = "0x1234...";
    const messagePoint = await yaaa.bls.generateMessagePoint(userOpHash);
    console.log("Message Point:", messagePoint);

    // Note: Actual BLS signing is handled by the backend
    // using the server SDK's BLSSignatureService
  } catch (error) {
    console.error("BLS operation failed:", error);
  }
}

// ============================================
// 6. Usage in React / Next.js
// ============================================

/*
import { YAAAClient } from '@yaaa/sdk';
import { useState } from 'react';

// Create client instance (can be shared across components)
const yaaa = new YAAAClient({
  apiURL: process.env.NEXT_PUBLIC_API_URL!,
  tokenProvider: () => localStorage.getItem('token'),
  bls: {
    seedNodes: [process.env.NEXT_PUBLIC_BLS_SEED_NODE!],
  },
});

function LoginPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const result = await yaaa.passkey.register({
        email: 'user@example.com',
        username: 'JohnDoe',
      });
      setUser(result.user);
      localStorage.setItem('token', result.token);
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await yaaa.passkey.authenticate();
      setUser(result.user);
      localStorage.setItem('token', result.token);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleRegister} disabled={loading}>
        Register with Passkey
      </button>
      <button onClick={handleLogin} disabled={loading}>
        Login with Passkey
      </button>
      {user && <p>Welcome, {user.username}!</p>}
    </div>
  );
}
*/

// ============================================
// Export for module usage
// ============================================

export {
  yaaa,
  registerWithPasskey,
  loginWithPasskey,
  sendTransaction,
  demonstrateBLS,
};

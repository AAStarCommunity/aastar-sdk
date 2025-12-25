# Getting Started

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**

## Overview

AAStar SDK is a comprehensive TypeScript SDK for interacting with the AAStar Public Goods Infrastructure and creating Your Own Protocol (YOP). It provides Account Abstraction (ERC-4337) capabilities with advanced features like gasless SuperPaymaster (AOA+), EOA Rainbow Bridge, community management, and reputation systems.

## Key Features

- **Role-Based Clients**: Specific APIs for End Users, Communities, Operators, and Admins.
- **Account Abstraction**: Full ERC-4337 support with session keys and social recovery.
- **Gasless Experience**: Zero-gas transactions via community credit and SuperPaymaster.
- **Rainbow Bridge**: Seamless connectivity between EOA and Smart Accounts.
- **Reputation System**: On-chain scoring and rule management for DAOs.

## Installation

```bash
pnpm add @aastar/sdk
# or individual packages
pnpm add @aastar/core @aastar/account @aastar/paymaster
```

## Quick Start

```typescript
import { createOperatorClient, createEndUserClient } from '@aastar/core';
import { http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Create an Operator client
const operatorClient = createOperatorClient({
  chain: sepolia,
  transport: http('https://rpc.sepolia.org'),
  account: privateKeyToAccount('0x...'),
});

// Stake GTokens to become an operator
const stakeTx = await operatorClient.stake({
  amount: parseEther('100'),
});
```

---

## Role-Based Architecture

AAStar SDK v2 uses a **Decorator** pattern to provide specialized clients for different roles in the ecosystem:

| Client | Targeted Developer | Core Responsibility |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp Developer | Gasless UX, Smart Account management, Credit/Debt queries |
| **`CommunityClient`** | Community/DAO Admin | Auto-onboarding, xPNTs deployment, SBT & Reputation config |
| **`OperatorClient`** | Node/Operator | SuperPaymaster registration, Staking, Pool management |
| **`AdminClient`** | Protocol Admin | DVT aggregations, Slashing, Global parameters |

---

## Support & Contributing

- **Repository**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)
- **Discord**: [Join our community](https://discord.gg/aastar)
- **License**: MIT

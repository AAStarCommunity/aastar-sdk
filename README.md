# AAStar SDK

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**

## Overview

AAStar SDK is a high-integration toolkit for the Mycelium network. It provides Account Abstraction (ERC-4337) capabilities with advanced features like gasless SuperPaymaster (AOA+), EOA Rainbow Bridge, community management, and reputation systems.

## Key Features

- ✅ **Role-Based Clients**: Specific APIs for End Users, Communities, Operators, and Admins.
- ✅ **Seamless User Experience**: Gasless transactions via community credit system.
- ✅ **Infrastructure Ready**: Deep integration with SuperPaymaster and EOA Bridge.
- ✅ **Scientific Reproducibility**: Version-locked for academic research and data collection.

## Modules

- **`@aastar/core`**: Core clients and contract addresses.
- **`@aastar/account`**: Smart account management (ERC-4337/7702).
- **`@aastar/paymaster`**: Gas sponsorship and eligibility logic.
- **`@aastar/finance`**: Credit system and GToken staking.

## Installation

```bash
pnpm add @aastar/sdk viem
```

## Quick Start

```typescript
import { createEndUserClient } from '@aastar/sdk';
import { http } from 'viem';
import { sepolia } from 'viem/chains';

const user = createEndUserClient({
  chain: sepolia,
  transport: http(),
  account: myAccount
});

// Send a gasless transaction
await user.sendGaslessTransaction({
  to: TARGET_ADDRESS,
  data: CALL_DATA
});
```

## Support

- **Documentation**: [docs.aastar.io](https://docs.aastar.io)
- **GitHub**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)

MIT © AAStar Community

# Reputation System

On-chain reputation tracking with customizable rules and scoring.

## Overview

The Reputation System enables:
- On-chain reputation tracking
- Customizable scoring rules
- Community-specific metrics
- Credit limit calculation

## Architecture

```
User Actions → Metrics → Reputation Score → Credit Limit
```

## Components

### 1. Metrics

Measurable user activities:
- Code contributions
- Community engagement
- Governance participation
- Transaction history

### 2. Scoring Rules

Community-defined weights:

```typescript
await community.setReputationRules({
  rules: [
    { metric: 'contributions', weight: 40 },
    { metric: 'engagement', weight: 30 },
    { metric: 'governance', weight: 30 },
  ],
});
```

### 3. Reputation Score

Calculated from metrics and weights:

```
score = (metric1 * weight1) + (metric2 * weight2) + ...
```

### 4. Credit Limit

Based on reputation:

```
creditLimit = baseLimit * (reputationScore / 1000)
```

## Usage

```typescript
import { getReputationScore } from '@aastar/identity';

// Get user's reputation
const score = await getReputationScore(
  client,
  userAddress,
  communityAddress
);

console.log('Reputation:', score.toString());

// Higher reputation = higher credit limit
const credit = await user.getCreditLimit();
```

## Benefits

1. **Trustless**: On-chain, verifiable
2. **Customizable**: Each community sets rules
3. **Fair**: Transparent scoring
4. **Dynamic**: Updates with user activity

## Use Cases

- Gas credit limits
- Governance voting power
- Access control
- Reward distribution

## Related

- [Identity Module](/api/modules/identity)
- [Community API](/api/roles/community)
- [End User API](/api/roles/enduser)

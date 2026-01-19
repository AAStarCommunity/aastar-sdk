/**
 * EventDecoder - 解析链上 Event Logs
 * 
 * 使用 viem 的 decodeEventLog 解析 SuperPaymaster 和 Paymaster 的关键事件
 */

import { decodeEventLog, type Log } from 'viem';
import SuperPaymasterABI from '../../../core/src/abis/SuperPaymaster.json';
import PaymasterABI from '../../../core/src/abis/Paymaster.json';

export interface TransactionSponsoredEvent {
  type: 'TransactionSponsored';
  operator: string;
  user: string;
  apntsConsumed: bigint;
  xpntsCharged: bigint;
}

export interface PostOpProcessedEvent {
  type: 'PostOpProcessed';
  user: string;
  token: string;
  actualGasCostWei: bigint;
  tokenCost: bigint;
  protocolRevenue: bigint;
}

export type DecodedPaymasterEvent = TransactionSponsoredEvent | PostOpProcessedEvent;

export class EventDecoder {
  /**
   * 解析 SuperPaymaster 的 TransactionSponsored 事件
   */
  static decodeTransactionSponsored(log: Log): TransactionSponsoredEvent | null {
    // TransactionSponsored(address,address,uint256,uint256)
    if (log.topics[0] !== '0xcde7e91a718e2439d8ff2a679ad52713e82a37b72622fb530c8c41039fdd5bf0') {
      return null;
    }

    try {
      const decoded = decodeEventLog({
        abi: [{
          type: 'event',
          name: 'TransactionSponsored',
          inputs: [
            { name: 'operator', type: 'address', indexed: true },
            { name: 'user', type: 'address', indexed: true },
            { name: 'aPNTsCost', type: 'uint256', indexed: false },
            { name: 'xPNTsCost', type: 'uint256', indexed: false },
          ],
        }],
        data: log.data,
        topics: log.topics,
      });

      if (decoded.args) {
        const args = decoded.args as any;
        return {
          type: 'TransactionSponsored',
          operator: args.operator,
          user: args.user,
          apntsConsumed: BigInt(args.aPNTsCost || 0),
          xpntsCharged: BigInt(args.xPNTsCost || 0),
        };
      }
    } catch (e) {
      console.warn('⚠️  decodeTransactionSponsored 失败:', (e as Error).message);
    }
    
    return null;
  }

  /**
   * 解析 Paymaster 的 PostOpProcessed 事件
   */
  static decodePostOpProcessed(log: Log): PostOpProcessedEvent | null {
    // PostOpProcessed(address,address,uint256,uint256,uint256)
    if (log.topics[0] !== '0x62544d7f48b11c32334310ebd306b47224fca220163218d4a7264322c52ae073') {
      return null;
    }

    try {
      const decoded = decodeEventLog({
        abi: [{
          type: 'event',
          name: 'PostOpProcessed',
          inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'token', type: 'address', indexed: true },
            { name: 'actualGasCostWei', type: 'uint256', indexed: false },
            { name: 'tokenCost', type: 'uint256', indexed: false },
            { name: 'protocolRevenue', type: 'uint256', indexed: false },
          ],
        }],
        data: log.data,
        topics: log.topics,
      });

      if (decoded.args) {
        const args = decoded.args as any;
        return {
          type: 'PostOpProcessed',
          user: args.user,
          token: args.token,
          actualGasCostWei: BigInt(args.actualGasCostWei || 0),
          tokenCost: BigInt(args.tokenCost || 0),
          protocolRevenue: BigInt(args.protocolRevenue || 0),
        };
      }
    } catch (e) {
      console.warn('⚠️  decodePostOpProcessed 失败:', (e as Error).message);
    }
    
    return null;
  }

  /**
   * 自动识别并解析 Paymaster 事件
   */
  static decode(log: Log): DecodedPaymasterEvent | null {
    // 优先尝试 SuperPaymaster
    const superEvent = this.decodeTransactionSponsored(log);
    if (superEvent) return superEvent;

    // 尝试 Paymaster
    const paymasterEvent = this.decodePostOpProcessed(log);
    if (paymasterEvent) return paymasterEvent;

    return null;
  }

  /**
   * 批量解析日志
   */
  static decodeAll(logs: Log[]): DecodedPaymasterEvent[] {
    const events: DecodedPaymasterEvent[] = [];

    // console.log(`🔍 Scanning ${logs.length} logs for Paymaster events...`);
    for (const log of logs) {
      const decoded = this.decode(log);
      if (decoded) {
        events.push(decoded);
      }
    }

    if (events.length > 0) {
      console.log(`✨ Found ${events.length} Paymaster events`);
    }

    return events;
  }
}

// ─── AT Protocol Lexicon types for 小黑书 ─────────────────────────────────────

/** Image blob in AT Protocol format */
export interface XiaoHeiImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** IPFS CID if stored on IPFS */
  cid?: string;
}

/** Location tag on a note */
export interface XiaoHeiLocation {
  name: string;
  lat?: number;
  lng?: number;
  /** City / region for filtering */
  city?: string;
}

/** Price tag (for product reviews / venue posts) */
export interface XiaoHeiPrice {
  amount: string;
  currency: 'CNY' | 'USD' | 'USDC' | 'ETH';
}

/** A 小黑书 note (AT Protocol lexicon: app.xiaohei.note) */
export interface XiaoHeiNote {
  /** AT URI — e.g. at://did:plc:xyz/app.xiaohei.note/1 */
  uri?: string;
  /** Content hash (CID) */
  cid?: string;
  /** Author identity */
  author: XiaoHeiAuthor;
  title: string;
  body: string;
  images?: XiaoHeiImage[];
  tags?: string[];
  location?: XiaoHeiLocation;
  price?: XiaoHeiPrice;
  category?: NoteCategory;
  createdAt: string;
  /** Engagement counts (populated by AppView / Feed Generator) */
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  /** Spore Protocol: USDC tip address (optional) */
  tipAddress?: string;
}

export type NoteCategory =
  | 'food'
  | 'fashion'
  | 'travel'
  | 'beauty'
  | 'fitness'
  | 'home'
  | 'tech'
  | 'other';

/** Author profile (AT Protocol DID + handle) */
export interface XiaoHeiAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  /** Spore Protocol Nostr pubkey for DM + payment */
  sporePubkey?: string;
  /** SBT tier for reputation display */
  sbtTier?: 'seed' | 'sprout' | 'mycelium' | 'spore';
}

/** Tip / payment record (AT Protocol lexicon: app.xiaohei.tip) */
export interface XiaoHeiTip {
  noteUri: string;
  from: XiaoHeiAuthor;
  to: XiaoHeiAuthor;
  amount: bigint;
  token: string;
  txHash: string;
  message?: string;
  createdAt: string;
}

/** Feed item — note + interaction state */
export interface FeedItem {
  note: XiaoHeiNote;
  isLiked?: boolean;
  isSaved?: boolean;
}

/** Application-level config */
export interface XiaoHeiConfig {
  /** AT Protocol PDS endpoint */
  pdsUrl: string;
  /** Spore Protocol relay list */
  sporeRelays?: string[];
  /** USDC token address on Optimism */
  usdcAddress: string;
  /** Spore HTTP Gateway URL (for browser environments) */
  gatewayUrl?: string;
}

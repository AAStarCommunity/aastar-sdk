// EventStore: interface definitions for Nostr event storage

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface EventFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  '#e'?: string[];
  '#p'?: string[];
}

export interface EventStore {
  save(event: NostrEvent): void;
  query(filter: EventFilter): NostrEvent[];
  has(id: string): boolean;
}

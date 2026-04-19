// ReactionCodec — NIP-25 style emoji reactions.
//
// Encodes a reaction as JSON in the Nostr event content field.
// The 'ct' tag is set to "spore/reaction/1.0".
//
// Wire format (event content):
//   {"emoji":"🔥","action":"added","referencedMessageId":"<event-id>"}
//
// NIP-25 compatibility: the standard reaction event (kind:7) uses the
// event content directly as the reaction emoji. For Spore we encode the
// full ReactionContent struct to carry richer metadata, but provide a
// fallback() that returns just the emoji for NIP-25-compatible clients.

import type { SporeCodec, SporeContentTypeId } from './SporeCodec.js';

export const ContentTypeReaction: SporeContentTypeId = {
    authority: 'spore',
    type: 'reaction',
    version: '1.0',
};

/** Reaction actions — 'added' when reacting, 'removed' to un-react */
export type ReactionAction = 'added' | 'removed';

/** Structured content for a reaction message */
export interface ReactionContent {
    /** Reaction emoji or text (e.g. "🔥", "+", "-") */
    emoji: string;
    /** Whether the reaction is being added or removed */
    action: ReactionAction;
    /** The Nostr event id this reaction is for */
    referencedMessageId: string;
}

export class ReactionCodec implements SporeCodec<ReactionContent> {
    readonly contentType = ContentTypeReaction;

    encode(content: ReactionContent): string {
        return JSON.stringify({
            emoji: content.emoji,
            action: content.action,
            referencedMessageId: content.referencedMessageId,
        });
    }

    decode(encoded: string): ReactionContent {
        const parsed = JSON.parse(encoded) as Record<string, unknown>;
        if (
            typeof parsed['emoji'] !== 'string' ||
            typeof parsed['action'] !== 'string' ||
            typeof parsed['referencedMessageId'] !== 'string'
        ) {
            throw new Error('ReactionCodec: malformed reaction content');
        }
        return {
            emoji: parsed['emoji'],
            action: parsed['action'] as ReactionAction,
            referencedMessageId: parsed['referencedMessageId'],
        };
    }

    /** Fallback: return just the emoji for NIP-25 compatible clients */
    fallback(encoded: string): string {
        try {
            const content = this.decode(encoded);
            return content.emoji;
        } catch {
            return encoded;
        }
    }
}

// ReplyCodec — structured reply with quoted message reference.
//
// Encodes a reply as JSON in the Nostr event content field.
// The 'ct' tag is set to "spore/reply/1.0".
//
// Wire format (event content):
//   {"text":"Great point!","referencedMessageId":"<event-id>"}
//
// The NIP-10 'e' reply tag is still set on the Nostr event (via replyToId
// in SendDmOptions/SendGroupMessageOptions) so standard Nostr clients thread
// the message correctly.

import type { SporeCodec, SporeContentTypeId } from './SporeCodec.js';

export const ContentTypeReply: SporeContentTypeId = {
    authority: 'spore',
    type: 'reply',
    version: '1.0',
};

/** Structured content for a reply message */
export interface ReplyContent {
    /** The reply text */
    text: string;
    /** The Nostr event id this reply references */
    referencedMessageId: string;
}

export class ReplyCodec implements SporeCodec<ReplyContent> {
    readonly contentType = ContentTypeReply;

    encode(content: ReplyContent): string {
        return JSON.stringify({
            text: content.text,
            referencedMessageId: content.referencedMessageId,
        });
    }

    decode(encoded: string): ReplyContent {
        const parsed = JSON.parse(encoded) as Record<string, unknown>;
        if (
            typeof parsed['text'] !== 'string' ||
            typeof parsed['referencedMessageId'] !== 'string'
        ) {
            throw new Error('ReplyCodec: malformed reply content');
        }
        return {
            text: parsed['text'],
            referencedMessageId: parsed['referencedMessageId'],
        };
    }

    /** Fallback: return just the reply text */
    fallback(encoded: string): string {
        try {
            const content = this.decode(encoded);
            return content.text;
        } catch {
            return encoded;
        }
    }
}

// TextCodec — passthrough codec for plain UTF-8 text (default content type).
//
// This is the fallback codec used when a Nostr event has no 'ct' tag.
// Encode/decode are identity operations.

import type { SporeCodec, SporeContentTypeId } from './SporeCodec.js';

export const ContentTypeText: SporeContentTypeId = {
    authority: 'spore',
    type: 'text',
    version: '1.0',
};

export class TextCodec implements SporeCodec<string> {
    readonly contentType = ContentTypeText;

    encode(content: string): string {
        return content;
    }

    decode(encoded: string): string {
        return encoded;
    }
}

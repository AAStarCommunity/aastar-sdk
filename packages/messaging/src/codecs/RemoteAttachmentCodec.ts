// RemoteAttachmentCodec — metadata pointer to an off-chain file.
//
// Encodes a URL + file metadata as JSON in the Nostr event content field.
// The 'ct' tag is set to "spore/remote-attachment/1.0".
//
// Wire format (event content):
//   {
//     "url": "https://...",
//     "filename": "photo.jpg",
//     "mimeType": "image/jpeg",
//     "sizeBytes": 102400,
//     "contentDigest": "sha256:<hex>"
//   }
//
// Security notes:
//   - contentDigest (optional) allows receivers to verify the file integrity
//     after download — protects against URL swap attacks.
//   - The URL itself should use HTTPS or an immutable content-addressed scheme
//     (e.g. IPFS, Arweave). Plaintext HTTP is intentionally not blocked here
//     since dev environments use http://, but callers should validate in prod.
//   - paymentRequired (optional) signals that the file requires x402 payment
//     via the M2 bridge layer before access.

import type { SporeCodec, SporeContentTypeId } from './SporeCodec.js';

export const ContentTypeRemoteAttachment: SporeContentTypeId = {
    authority: 'spore',
    type: 'remote-attachment',
    version: '1.0',
};

/** Structured content for a remote attachment message */
export interface RemoteAttachmentContent {
    /** URL where the file can be fetched */
    url: string;
    /** Original file name (for display) */
    filename: string;
    /** MIME type (e.g. "image/jpeg", "application/pdf") */
    mimeType: string;
    /** File size in bytes (optional, for display) */
    sizeBytes?: number;
    /**
     * Content integrity digest: "sha256:<hex>" or "blake3:<hex>".
     * Receivers should verify the downloaded file against this digest.
     */
    contentDigest?: string;
    /**
     * If true, the file requires an x402 payment commitment to access.
     * The receiver should use the X402Bridge to obtain the file URL
     * after submitting payment via kind:23402.
     */
    paymentRequired?: boolean;
}

export class RemoteAttachmentCodec implements SporeCodec<RemoteAttachmentContent> {
    readonly contentType = ContentTypeRemoteAttachment;

    encode(content: RemoteAttachmentContent): string {
        const payload: Record<string, unknown> = {
            url: content.url,
            filename: content.filename,
            mimeType: content.mimeType,
        };
        if (content.sizeBytes !== undefined) payload['sizeBytes'] = content.sizeBytes;
        if (content.contentDigest) payload['contentDigest'] = content.contentDigest;
        if (content.paymentRequired !== undefined) payload['paymentRequired'] = content.paymentRequired;
        return JSON.stringify(payload);
    }

    decode(encoded: string): RemoteAttachmentContent {
        const parsed = JSON.parse(encoded) as Record<string, unknown>;
        if (
            typeof parsed['url'] !== 'string' ||
            typeof parsed['filename'] !== 'string' ||
            typeof parsed['mimeType'] !== 'string'
        ) {
            throw new Error('RemoteAttachmentCodec: missing required fields (url, filename, mimeType)');
        }
        return {
            url: parsed['url'],
            filename: parsed['filename'],
            mimeType: parsed['mimeType'],
            sizeBytes: typeof parsed['sizeBytes'] === 'number' ? parsed['sizeBytes'] : undefined,
            contentDigest: typeof parsed['contentDigest'] === 'string' ? parsed['contentDigest'] : undefined,
            paymentRequired: typeof parsed['paymentRequired'] === 'boolean' ? parsed['paymentRequired'] : undefined,
        };
    }

    /** Fallback: display filename and URL for clients without this codec */
    fallback(encoded: string): string {
        try {
            const content = this.decode(encoded);
            return `[Attachment: ${content.filename}] ${content.url}`;
        } catch {
            return '[Attachment]';
        }
    }
}

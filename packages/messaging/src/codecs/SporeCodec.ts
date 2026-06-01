// SporeCodec — Content Type Codec interface for @aastar/messaging.
//
// Design mirrors the XMTP ContentTypeCodec interface so callers can migrate
// custom codecs by changing only the import path.
//
// Architecture:
//   - SporeContentTypeId: string "authority/type/version" (e.g. "spore/reaction/1.0")
//   - SporeCodec<T>: encode(T) → string, decode(string) → T
//   - CodecRegistry: Map-backed lookup keyed by content type id string
//   - Nostr wire format: event content holds encoded payload;
//     a ['ct', '<id>'] tag identifies the codec.
//     Events without a 'ct' tag are treated as plain text (TextCodec).

// ─── Content Type Id ──────────────────────────────────────────────────────────

/**
 * Structured representation of a Spore content type identifier.
 * Serializes to "authority/type/version" (e.g. "spore/text/1.0").
 */
export interface SporeContentTypeId {
    /** Short namespace, e.g. "spore" */
    authority: string;
    /** Content kind, e.g. "text", "reaction", "reply", "remote-attachment" */
    type: string;
    /** Semver-style version, e.g. "1.0" */
    version: string;
}

/** Serialize a SporeContentTypeId to its string representation. */
export function contentTypeIdToString(id: SporeContentTypeId): string {
    return `${id.authority}/${id.type}/${id.version}`;
}

/** Parse a content type id string into its structured representation. */
export function parseContentTypeId(raw: string): SporeContentTypeId | null {
    const parts = raw.split('/');
    if (parts.length !== 3) return null;
    const [authority, type, version] = parts;
    if (!authority || !type || !version) return null;
    return { authority, type, version };
}

// ─── Codec Interface ──────────────────────────────────────────────────────────

/**
 * SporeCodec<T> — bidirectional content codec for a specific content type.
 *
 * Implementations serialize/deserialize structured content to/from the Nostr
 * event content string.
 *
 * @example
 * ```ts
 * class MyCodec implements SporeCodec<MyType> {
 *   readonly contentType = { authority: 'myapp', type: 'mytype', version: '1.0' };
 *   encode(content: MyType): string { return JSON.stringify(content); }
 *   decode(encoded: string): MyType { return JSON.parse(encoded); }
 * }
 * agent.registerCodec(new MyCodec());
 * ```
 */
export interface SporeCodec<T = unknown> {
    /**
     * The content type identifier this codec handles.
     * Serialized to the 'ct' tag in Nostr events.
     */
    readonly contentType: SporeContentTypeId;

    /**
     * Serialize content to a string for the Nostr event content field.
     * @param content - Structured content to encode
     * @returns Encoded string (typically JSON)
     */
    encode(content: T): string;

    /**
     * Deserialize a Nostr event content string back to structured content.
     * @param encoded - Raw event content string
     * @returns Structured content, or throws if malformed
     */
    decode(encoded: string): T;

    /**
     * Optional: provide a plain-text fallback for receivers without this codec.
     * Returned as the message content when no matching codec is registered.
     * If not provided, the raw encoded string is used as fallback.
     */
    fallback?(encoded: string): string;
}

// ─── Codec Registry ───────────────────────────────────────────────────────────

/**
 * CodecRegistry — lightweight Map-backed codec lookup.
 *
 * Codecs are keyed by their content type id string ("authority/type/version").
 * The registry includes a built-in TextCodec as the default (no 'ct' tag).
 */
export class CodecRegistry {
    private readonly codecs = new Map<string, SporeCodec<unknown>>();

    constructor(defaults: SporeCodec<unknown>[] = []) {
        for (const codec of defaults) {
            this.register(codec);
        }
    }

    /** Register a codec. Overwrites any existing registration for the same type. */
    register(codec: SporeCodec<unknown>): void {
        this.codecs.set(contentTypeIdToString(codec.contentType), codec);
    }

    /**
     * Look up a codec by its content type id string.
     * Returns undefined if no matching codec is registered.
     */
    get(contentTypeIdStr: string): SporeCodec<unknown> | undefined {
        return this.codecs.get(contentTypeIdStr);
    }

    /** Returns true if a codec is registered for the given type string. */
    has(contentTypeIdStr: string): boolean {
        return this.codecs.has(contentTypeIdStr);
    }
}

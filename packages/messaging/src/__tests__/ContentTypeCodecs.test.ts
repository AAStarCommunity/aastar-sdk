// Unit tests for M7 Content Type Codecs:
//   SporeCodec interface, CodecRegistry
//   TextCodec, ReactionCodec, ReplyCodec, RemoteAttachmentCodec
//   SporeAgent.registerCodec() + automatic decode on incoming messages
//   MessageContext.getDecodedContent() / isContentType() / sendReply() / sendReaction() / sendAttachment()

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    CodecRegistry,
    contentTypeIdToString,
    parseContentTypeId,
    type SporeContentTypeId,
} from '../codecs/SporeCodec.js';
import { TextCodec, ContentTypeText } from '../codecs/TextCodec.js';
import { ReactionCodec, ContentTypeReaction, type ReactionContent } from '../codecs/ReactionCodec.js';
import { ReplyCodec, ContentTypeReply, type ReplyContent } from '../codecs/ReplyCodec.js';
import {
    RemoteAttachmentCodec,
    ContentTypeRemoteAttachment,
    type RemoteAttachmentContent,
} from '../codecs/RemoteAttachmentCodec.js';
import { MessageContext } from '../MessageContext.js';
import { SporeAgent } from '../SporeAgent.js';
import type { SporeMessage, SporeConversation, SignedNostrEvent } from '../types.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../identity/AirAccountIdentity.js', () => ({
    createIdentity: vi.fn().mockResolvedValue({
        pubkey: 'self'.padEnd(64, '0'),
        address: '0x' + 'a'.repeat(40),
        privateKeyHex: 'priv'.padEnd(64, '0'),
    }),
    createIdentityFromEnv: vi.fn(),
}));

const mockSendDm = vi.fn().mockResolvedValue('dm-event-id');
const mockSendGroupMessage = vi.fn().mockResolvedValue('group-event-id');

vi.mock('../relay/RelayPool.js', () => ({
    DEFAULT_RELAYS: ['ws://localhost:9999'],
    parseRelaysFromEnv: vi.fn().mockReturnValue([]),
    RelayPool: vi.fn().mockImplementation(() => ({
        connectedRelays: ['ws://localhost:9999'],
        publish: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockReturnValue(() => {}),
        subscribeMany: vi.fn().mockReturnValue(() => {}),
        fetchEvents: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('../transport/NostrTransport.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../transport/NostrTransport.js')>();
    return {
        ...actual,
        NostrTransport: vi.fn().mockImplementation(() => ({
            subscribeToDms: vi.fn().mockReturnValue(() => {}),
            subscribeToGroups: vi.fn().mockReturnValue(() => {}),
            sendDm: mockSendDm,
            sendGroupMessage: mockSendGroupMessage,
            sendGroupMeta: vi.fn().mockResolvedValue(''),
            sendGroupMembership: vi.fn().mockResolvedValue(''),
            decryptDm: vi.fn().mockReturnValue(null),
            decodeGroup: vi.fn().mockReturnValue(null),
        })),
    };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DM_CONV: SporeConversation = {
    id: 'dm-conv',
    type: 'dm',
    members: ['self'.padEnd(64, '0'), 'other'.padEnd(64, '0')],
    createdAt: 1000,
};

function makeMessage(
    content: string,
    contentTypeId?: string,
    decodedContent?: unknown
): SporeMessage {
    return {
        id: 'msg-1',
        senderPubkey: 'other'.padEnd(64, '0'),
        content,
        contentType: 'text',
        contentTypeId,
        decodedContent,
        sentAt: 1000,
        conversation: DM_CONV,
        rawEvent: { id: 'msg-1', kind: 14, content, tags: [], created_at: 1000, pubkey: 'other'.padEnd(64, '0'), sig: 'x'.repeat(128) } as SignedNostrEvent,
    };
}

function makeMessageContext(
    message: SporeMessage,
    codecRegistry?: CodecRegistry,
    sendTypedMessage?: (conv: SporeConversation, typeId: string, content: unknown) => Promise<string>
): MessageContext {
    return new MessageContext({
        message,
        transport: {
            sendDm: mockSendDm,
            sendGroupMessage: mockSendGroupMessage,
        } as never,
        selfPrivkeyHex: 'priv'.padEnd(64, '0'),
        selfPubkeyHex: 'self'.padEnd(64, '0'),
        codecRegistry,
        sendTypedMessage,
    });
}

// ─── contentTypeIdToString / parseContentTypeId ───────────────────────────────

describe('ContentTypeId utilities', () => {
    it('serializes to "authority/type/version"', () => {
        expect(contentTypeIdToString({ authority: 'spore', type: 'text', version: '1.0' }))
            .toBe('spore/text/1.0');
    });

    it('parses valid string into structured object', () => {
        const parsed = parseContentTypeId('spore/reaction/1.0');
        expect(parsed).toEqual({ authority: 'spore', type: 'reaction', version: '1.0' });
    });

    it('returns null for malformed strings', () => {
        expect(parseContentTypeId('bad')).toBeNull();
        expect(parseContentTypeId('a/b')).toBeNull();
        expect(parseContentTypeId('')).toBeNull();
    });
});

// ─── CodecRegistry ────────────────────────────────────────────────────────────

describe('CodecRegistry', () => {
    it('registers and retrieves a codec by type string', () => {
        const registry = new CodecRegistry();
        const codec = new TextCodec();
        registry.register(codec);
        expect(registry.get('spore/text/1.0')).toBe(codec);
    });

    it('has() returns true for registered types', () => {
        const registry = new CodecRegistry([new ReactionCodec()]);
        expect(registry.has('spore/reaction/1.0')).toBe(true);
        expect(registry.has('spore/reply/1.0')).toBe(false);
    });

    it('accepts default codecs via constructor', () => {
        const registry = new CodecRegistry([new TextCodec(), new ReactionCodec()]);
        expect(registry.has('spore/text/1.0')).toBe(true);
        expect(registry.has('spore/reaction/1.0')).toBe(true);
    });

    it('last registered wins (overwrite)', () => {
        const registry = new CodecRegistry();
        const codec1 = new TextCodec();
        const codec2 = new TextCodec();
        registry.register(codec1);
        registry.register(codec2);
        expect(registry.get('spore/text/1.0')).toBe(codec2);
    });
});

// ─── TextCodec ────────────────────────────────────────────────────────────────

describe('TextCodec', () => {
    const codec = new TextCodec();

    it('has contentType spore/text/1.0', () => {
        expect(contentTypeIdToString(codec.contentType)).toBe('spore/text/1.0');
    });

    it('encode is identity', () => {
        expect(codec.encode('hello world')).toBe('hello world');
    });

    it('decode is identity', () => {
        expect(codec.decode('hello world')).toBe('hello world');
    });
});

// ─── ReactionCodec ────────────────────────────────────────────────────────────

describe('ReactionCodec', () => {
    const codec = new ReactionCodec();

    it('has contentType spore/reaction/1.0', () => {
        expect(contentTypeIdToString(codec.contentType)).toBe('spore/reaction/1.0');
    });

    it('encodes reaction to JSON', () => {
        const content: ReactionContent = {
            emoji: '🔥',
            action: 'added',
            referencedMessageId: 'abc123',
        };
        const encoded = codec.encode(content);
        const parsed = JSON.parse(encoded);
        expect(parsed.emoji).toBe('🔥');
        expect(parsed.action).toBe('added');
        expect(parsed.referencedMessageId).toBe('abc123');
    });

    it('round-trips encode → decode', () => {
        const content: ReactionContent = { emoji: '❤️', action: 'removed', referencedMessageId: 'xyz' };
        expect(codec.decode(codec.encode(content))).toEqual(content);
    });

    it('fallback returns the emoji', () => {
        const content: ReactionContent = { emoji: '👍', action: 'added', referencedMessageId: 'id1' };
        expect(codec.fallback(codec.encode(content))).toBe('👍');
    });

    it('decode throws on malformed JSON', () => {
        expect(() => codec.decode('{"emoji":"x"}')).toThrow('ReactionCodec');
    });
});

// ─── ReplyCodec ───────────────────────────────────────────────────────────────

describe('ReplyCodec', () => {
    const codec = new ReplyCodec();

    it('has contentType spore/reply/1.0', () => {
        expect(contentTypeIdToString(codec.contentType)).toBe('spore/reply/1.0');
    });

    it('round-trips encode → decode', () => {
        const content: ReplyContent = { text: 'Great point!', referencedMessageId: 'msg-abc' };
        expect(codec.decode(codec.encode(content))).toEqual(content);
    });

    it('fallback returns the reply text', () => {
        const content: ReplyContent = { text: 'Agreed!', referencedMessageId: 'msg-1' };
        expect(codec.fallback(codec.encode(content))).toBe('Agreed!');
    });

    it('decode throws on missing fields', () => {
        expect(() => codec.decode('{"text":"hi"}')).toThrow('ReplyCodec');
    });
});

// ─── RemoteAttachmentCodec ────────────────────────────────────────────────────

describe('RemoteAttachmentCodec', () => {
    const codec = new RemoteAttachmentCodec();

    it('has contentType spore/remote-attachment/1.0', () => {
        expect(contentTypeIdToString(codec.contentType)).toBe('spore/remote-attachment/1.0');
    });

    it('round-trips required fields', () => {
        const content: RemoteAttachmentContent = {
            url: 'https://example.com/file.pdf',
            filename: 'file.pdf',
            mimeType: 'application/pdf',
        };
        expect(codec.decode(codec.encode(content))).toMatchObject(content);
    });

    it('round-trips optional fields', () => {
        const content: RemoteAttachmentContent = {
            url: 'https://example.com/photo.jpg',
            filename: 'photo.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 102400,
            contentDigest: 'sha256:abc123',
            paymentRequired: true,
        };
        expect(codec.decode(codec.encode(content))).toEqual(content);
    });

    it('fallback returns filename and URL', () => {
        const content: RemoteAttachmentContent = {
            url: 'https://example.com/doc.txt',
            filename: 'doc.txt',
            mimeType: 'text/plain',
        };
        const fb = codec.fallback(codec.encode(content));
        expect(fb).toContain('doc.txt');
        expect(fb).toContain('https://example.com/doc.txt');
    });

    it('decode throws on missing required fields', () => {
        expect(() => codec.decode('{"url":"x","filename":"y"}')).toThrow('RemoteAttachmentCodec');
    });
});

// ─── SporeAgent.registerCodec() + auto-decode ────────────────────────────────

describe('SporeAgent M7: registerCodec + auto-decode', () => {
    let agent: SporeAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = await SporeAgent.create({
            privateKeyHex: 'priv'.padEnd(64, '0'),
            relays: ['ws://localhost:9999'],
            env: 'test',
        });
    });

    it('registerCodec() returns this for chaining', () => {
        expect(agent.registerCodec(new ReactionCodec())).toBe(agent);
    });

    it('decodes incoming reaction message with registered codec', async () => {
        agent.registerCodec(new ReactionCodec());

        const reactionContent: ReactionContent = {
            emoji: '🔥',
            action: 'added',
            referencedMessageId: 'ref-1',
        };
        const encoded = new ReactionCodec().encode(reactionContent);

        const receivedMessages: SporeMessage[] = [];
        agent.on('message', async (ctx) => {
            receivedMessages.push(ctx.message);
        });

        // Simulate incoming message via private handleIncomingMessage
        const msg: SporeMessage = makeMessage(encoded, 'spore/reaction/1.0');
        await (agent as unknown as { handleIncomingMessage: (m: SporeMessage) => Promise<void> })
            .handleIncomingMessage(msg);

        expect(receivedMessages).toHaveLength(1);
        expect(receivedMessages[0]!.decodedContent).toEqual(reactionContent);
    });

    it('leaves decodedContent undefined when no codec registered for type', async () => {
        // ReactionCodec NOT registered
        const encoded = new ReactionCodec().encode({
            emoji: '👍', action: 'added', referencedMessageId: 'x',
        });

        const receivedMessages: SporeMessage[] = [];
        agent.on('message', async (ctx) => { receivedMessages.push(ctx.message); });

        const msg = makeMessage(encoded, 'spore/reaction/1.0');
        await (agent as unknown as { handleIncomingMessage: (m: SporeMessage) => Promise<void> })
            .handleIncomingMessage(msg);

        expect(receivedMessages[0]!.decodedContent).toBeUndefined();
    });
});

// ─── MessageContext M7: getDecodedContent / isContentType ─────────────────────

describe('MessageContext M7: getDecodedContent / isContentType', () => {
    it('getDecodedContent returns the typed content', () => {
        const decoded: ReactionContent = { emoji: '❤️', action: 'added', referencedMessageId: 'x' };
        const msg = makeMessage('', 'spore/reaction/1.0', decoded);
        const ctx = makeMessageContext(msg);
        expect(ctx.getDecodedContent<ReactionContent>()).toEqual(decoded);
    });

    it('getDecodedContent returns null when decodedContent is absent', () => {
        const msg = makeMessage('hello');
        const ctx = makeMessageContext(msg);
        expect(ctx.getDecodedContent()).toBeNull();
    });

    it('isContentType returns true for matching type', () => {
        const msg = makeMessage('', 'spore/reaction/1.0');
        const ctx = makeMessageContext(msg);
        expect(ctx.isContentType(ContentTypeReaction)).toBe(true);
    });

    it('isContentType returns false for non-matching type', () => {
        const msg = makeMessage('', 'spore/reaction/1.0');
        const ctx = makeMessageContext(msg);
        expect(ctx.isContentType(ContentTypeReply)).toBe(false);
    });
});

// ─── MessageContext M7: sendReaction / sendReply / sendAttachment ─────────────

describe('MessageContext M7: typed send helpers', () => {
    const REPLY_TYPE_ID = contentTypeIdToString(ContentTypeReply);
    const REACTION_TYPE_ID = contentTypeIdToString(ContentTypeReaction);
    const ATTACH_TYPE_ID = contentTypeIdToString(ContentTypeRemoteAttachment);

    it('sendReaction uses codec when registered', async () => {
        const registry = new CodecRegistry([new ReactionCodec()]);
        const mockSendTyped = vi.fn().mockResolvedValue('typed-event-id');
        const msg = makeMessage('');
        const ctx = makeMessageContext(msg, registry, mockSendTyped);

        await ctx.sendReaction('🔥');

        expect(mockSendTyped).toHaveBeenCalledWith(
            DM_CONV,
            REACTION_TYPE_ID,
            expect.objectContaining({ emoji: '🔥', action: 'added', referencedMessageId: 'msg-1' })
        );
    });

    it('sendReaction falls back to plain text when codec not registered', async () => {
        const registry = new CodecRegistry(); // no ReactionCodec
        const msg = makeMessage('');
        const ctx = makeMessageContext(msg, registry, undefined);

        const eventId = await ctx.sendReaction('👍');
        // Falls back to sendToConversation which calls mockSendDm
        expect(mockSendDm).toHaveBeenCalled();
    });

    it('sendReply uses ReplyCodec when registered', async () => {
        const registry = new CodecRegistry([new ReplyCodec()]);
        const mockSendTyped = vi.fn().mockResolvedValue('reply-event-id');
        const msg = makeMessage('original message');
        const ctx = makeMessageContext(msg, registry, mockSendTyped);

        await ctx.sendReply('That is correct!');

        expect(mockSendTyped).toHaveBeenCalledWith(
            DM_CONV,
            REPLY_TYPE_ID,
            expect.objectContaining({ text: 'That is correct!', referencedMessageId: 'msg-1' })
        );
    });

    it('sendReply falls back to plain text when ReplyCodec not registered', async () => {
        vi.clearAllMocks();
        const registry = new CodecRegistry(); // no ReplyCodec
        const msg = makeMessage('original');
        const ctx = makeMessageContext(msg, registry, undefined);

        await ctx.sendReply('My reply');
        expect(mockSendDm).toHaveBeenCalled();
    });

    it('sendAttachment uses RemoteAttachmentCodec when registered', async () => {
        const registry = new CodecRegistry([new RemoteAttachmentCodec()]);
        const mockSendTyped = vi.fn().mockResolvedValue('attach-event-id');
        const msg = makeMessage('');
        const ctx = makeMessageContext(msg, registry, mockSendTyped);

        const attachment: RemoteAttachmentContent = {
            url: 'https://files.example.com/photo.jpg',
            filename: 'photo.jpg',
            mimeType: 'image/jpeg',
        };
        await ctx.sendAttachment(attachment);

        expect(mockSendTyped).toHaveBeenCalledWith(DM_CONV, ATTACH_TYPE_ID, attachment);
    });

    it('sendAttachment falls back to plain URL text when codec not registered', async () => {
        vi.clearAllMocks();
        const registry = new CodecRegistry(); // no RemoteAttachmentCodec
        const msg = makeMessage('');
        const ctx = makeMessageContext(msg, registry, undefined);

        await ctx.sendAttachment({ url: 'https://x.com/f.txt', filename: 'f.txt', mimeType: 'text/plain' });
        expect(mockSendDm).toHaveBeenCalled();
    });
});

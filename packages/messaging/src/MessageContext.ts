// MessageContext — mirrors the XMTP agent-sdk MessageContext API.
//
// Passed to all message event handlers ('text', 'dm', 'group', 'message').
// Provides the decoded message, conversation metadata, and reply helpers.

import type { SporeMessage, SporeConversation } from './types.js';
import type { NostrTransport } from './transport/NostrTransport.js';
import type { CodecRegistry } from './codecs/SporeCodec.js';
import type { ReactionContent } from './codecs/ReactionCodec.js';
import type { RemoteAttachmentContent } from './codecs/RemoteAttachmentCodec.js';
import { contentTypeIdToString } from './codecs/SporeCodec.js';
import { ContentTypeReaction } from './codecs/ReactionCodec.js';
import { ContentTypeReply } from './codecs/ReplyCodec.js';
import { ContentTypeRemoteAttachment } from './codecs/RemoteAttachmentCodec.js';

export class MessageContext {
    /** The decoded incoming message */
    readonly message: SporeMessage;

    /** The conversation this message belongs to */
    readonly conversation: SporeConversation;

    private readonly transport: NostrTransport;
    private readonly selfPrivkeyHex: string;
    private readonly selfPubkeyHex: string;
    private readonly codecRegistry?: CodecRegistry;
    private readonly _sendTypedMessage?: (conv: SporeConversation, typeId: string, content: unknown) => Promise<string>;

    constructor(opts: {
        message: SporeMessage;
        transport: NostrTransport;
        selfPrivkeyHex: string;
        selfPubkeyHex: string;
        codecRegistry?: CodecRegistry;
        sendTypedMessage?: (conv: SporeConversation, typeId: string, content: unknown) => Promise<string>;
    }) {
        this.message = opts.message;
        this.conversation = opts.message.conversation;
        this.transport = opts.transport;
        this.selfPrivkeyHex = opts.selfPrivkeyHex;
        this.selfPubkeyHex = opts.selfPubkeyHex;
        this.codecRegistry = opts.codecRegistry;
        this._sendTypedMessage = opts.sendTypedMessage;
    }

    /**
     * M7: Access the structured decoded content when a matching codec was registered.
     * Returns null if no codec is registered for this message's content type.
     *
     * @example
     * ```ts
     * if (ctx.isContentType(ContentTypeReaction)) {
     *   const reaction = ctx.getDecodedContent<ReactionContent>();
     *   console.log(reaction?.emoji);
     * }
     * ```
     */
    getDecodedContent<T>(): T | null {
        return (this.message.decodedContent as T) ?? null;
    }

    /**
     * M7: Check if this message has a specific content type.
     *
     * @example
     * ```ts
     * agent.on('message', async (ctx) => {
     *   if (ctx.isContentType(ContentTypeReaction)) { ... }
     * });
     * ```
     */
    isContentType(contentType: { authority: string; type: string; version: string }): boolean {
        return this.message.contentTypeId === contentTypeIdToString(contentType);
    }

    /**
     * Get the Ethereum address of the message sender.
     * For M1, returns the Nostr pubkey as a hex address (0x-prefixed).
     * In M2 this will resolve via AirAccount registry.
     */
    getSenderAddress(): string {
        // Nostr pubkey as 0x-prefixed hex (32 bytes, not Eth address)
        return `0x${this.message.senderPubkey}`;
    }

    /**
     * Send a plain-text message to the same conversation.
     *
     * @param text - UTF-8 text content
     * @returns Nostr event id of the sent message
     */
    async sendText(text: string): Promise<string> {
        return this.sendToConversation(text);
    }

    /**
     * Send a plain-text reply that references the incoming message.
     * Uses NIP-10 'e' tag with 'reply' marker so clients thread correctly.
     *
     * @param text - UTF-8 text content
     * @returns Nostr event id of the sent reply
     */
    async sendTextReply(text: string): Promise<string> {
        return this.sendToConversation(text, this.message.id);
    }

    /**
     * Send a reaction to the incoming message.
     *
     * Uses ReactionCodec when registered on the agent for structured reaction data.
     * Falls back to sending the emoji as plain text if no ReactionCodec is registered.
     *
     * @param emoji  - Reaction emoji or text (e.g. "🔥", "+", "-")
     * @param action - Whether adding or removing the reaction (default: 'added')
     * @returns Nostr event id of the sent reaction
     */
    async sendReaction(emoji: string, action: 'added' | 'removed' = 'added'): Promise<string> {
        const reactionTypeId = contentTypeIdToString(ContentTypeReaction);

        if (this._sendTypedMessage && this.codecRegistry?.has(reactionTypeId)) {
            const reactionContent: ReactionContent = {
                emoji,
                action,
                referencedMessageId: this.message.id,
            };
            return this._sendTypedMessage(this.conversation, reactionTypeId, reactionContent);
        }

        // Fallback: send emoji as plain text with NIP-10 reply tag
        return this.sendToConversation(emoji, this.message.id);
    }

    /**
     * M7: Send a structured reply using ReplyCodec.
     *
     * Uses ReplyCodec when registered; falls back to plain-text reply.
     *
     * @param text - Reply text
     * @returns Nostr event id
     */
    async sendReply(text: string): Promise<string> {
        const replyTypeId = contentTypeIdToString(ContentTypeReply);

        if (this._sendTypedMessage && this.codecRegistry?.has(replyTypeId)) {
            return this._sendTypedMessage(this.conversation, replyTypeId, {
                text,
                referencedMessageId: this.message.id,
            });
        }

        // Fallback: plain-text reply with NIP-10 e-tag
        return this.sendToConversation(text, this.message.id);
    }

    /**
     * M7: Send a remote attachment using RemoteAttachmentCodec.
     *
     * @param attachment - Attachment metadata (url, filename, mimeType, ...)
     * @returns Nostr event id
     * @throws If RemoteAttachmentCodec is not registered on the agent
     */
    async sendAttachment(attachment: RemoteAttachmentContent): Promise<string> {
        const attachTypeId = contentTypeIdToString(ContentTypeRemoteAttachment);

        if (this._sendTypedMessage && this.codecRegistry?.has(attachTypeId)) {
            return this._sendTypedMessage(this.conversation, attachTypeId, attachment);
        }

        // Fallback: plain text with URL
        return this.sendToConversation(`[Attachment: ${attachment.filename}] ${attachment.url}`);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async sendToConversation(text: string, replyToId?: string): Promise<string> {
        if (this.conversation.type === 'dm') {
            const recipientPubkey = this.conversation.members.find(
                (pk) => pk !== this.selfPubkeyHex
            );
            if (!recipientPubkey) {
                throw new Error('MessageContext: cannot determine DM recipient');
            }
            return this.transport.sendDm({
                senderPrivkeyHex: this.selfPrivkeyHex,
                senderPubkeyHex: this.selfPubkeyHex,
                recipientPubkeyHex: recipientPubkey,
                content: text,
                replyToId,
            });
        } else {
            return this.transport.sendGroupMessage({
                senderPrivkeyHex: this.selfPrivkeyHex,
                senderPubkeyHex: this.selfPubkeyHex,
                groupId: this.conversation.id,
                memberPubkeys: this.conversation.members.filter(
                    (pk) => pk !== this.selfPubkeyHex
                ),
                content: text,
                replyToId,
            });
        }
    }
}

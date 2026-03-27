// MessageContext — mirrors the XMTP agent-sdk MessageContext API.
//
// Passed to all message event handlers ('text', 'dm', 'group', 'message').
// Provides the decoded message, conversation metadata, and reply helpers.

import type { SporeMessage, SporeConversation } from './types.js';
import type { NostrTransport } from './transport/NostrTransport.js';

export class MessageContext {
    /** The decoded incoming message */
    readonly message: SporeMessage;

    /** The conversation this message belongs to */
    readonly conversation: SporeConversation;

    private readonly transport: NostrTransport;
    private readonly selfPrivkeyHex: string;
    private readonly selfPubkeyHex: string;

    constructor(opts: {
        message: SporeMessage;
        transport: NostrTransport;
        selfPrivkeyHex: string;
        selfPubkeyHex: string;
    }) {
        this.message = opts.message;
        this.conversation = opts.message.conversation;
        this.transport = opts.transport;
        this.selfPrivkeyHex = opts.selfPrivkeyHex;
        this.selfPubkeyHex = opts.selfPubkeyHex;
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
     * Send a reaction (NIP-25) to the incoming message.
     * Standard reactions: "+" (like), "-" (dislike), or any emoji.
     *
     * @param emoji - Reaction content (e.g. "+", "🔥", "❤️")
     * @returns Nostr event id of the sent reaction
     */
    async sendReaction(emoji: string): Promise<string> {
        if (this.conversation.type === 'dm') {
            const recipientPubkey = this.conversation.members.find(
                (pk) => pk !== this.selfPubkeyHex
            );
            if (!recipientPubkey) {
                throw new Error('MessageContext.sendReaction: cannot determine DM recipient');
            }
            return this.transport.sendDm({
                senderPrivkeyHex: this.selfPrivkeyHex,
                senderPubkeyHex: this.selfPubkeyHex,
                recipientPubkeyHex: recipientPubkey,
                content: emoji,
                replyToId: this.message.id,
            });
        } else {
            return this.transport.sendGroupMessage({
                senderPrivkeyHex: this.selfPrivkeyHex,
                senderPubkeyHex: this.selfPubkeyHex,
                groupId: this.conversation.id,
                memberPubkeys: this.conversation.members.filter(
                    (pk) => pk !== this.selfPubkeyHex
                ),
                content: emoji,
                replyToId: this.message.id,
            });
        }
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

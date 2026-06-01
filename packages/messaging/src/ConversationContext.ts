// ConversationContext — mirrors the XMTP agent-sdk ConversationContext API.
//
// Passed to 'conversation' event handlers when a new conversation is discovered.
// Provides helpers to send messages and inspect the conversation type.

import type { SporeConversation } from './types.js';
import type { NostrTransport } from './transport/NostrTransport.js';

export class ConversationContext {
    /** The underlying SporeConversation object */
    readonly conversation: SporeConversation;

    private readonly transport: NostrTransport;
    private readonly senderPrivkeyHex: string;
    private readonly senderPubkeyHex: string;

    constructor(opts: {
        conversation: SporeConversation;
        transport: NostrTransport;
        senderPrivkeyHex: string;
        senderPubkeyHex: string;
    }) {
        this.conversation = opts.conversation;
        this.transport = opts.transport;
        this.senderPrivkeyHex = opts.senderPrivkeyHex;
        this.senderPubkeyHex = opts.senderPubkeyHex;
    }

    /** Returns true if this is a direct message conversation */
    isDm(): boolean {
        return this.conversation.type === 'dm';
    }

    /** Returns true if this is a group conversation */
    isGroup(): boolean {
        return this.conversation.type === 'group';
    }

    /**
     * Send a plain-text message to this conversation.
     *
     * @param text - UTF-8 text to send
     * @returns The Nostr event id of the sent message
     */
    async sendText(text: string): Promise<string> {
        if (this.isDm()) {
            // For DM: find the other participant's pubkey
            const recipientPubkey = this.conversation.members.find(
                (pk) => pk !== this.senderPubkeyHex
            );
            if (!recipientPubkey) {
                throw new Error('ConversationContext: cannot determine DM recipient');
            }
            return this.transport.sendDm({
                senderPrivkeyHex: this.senderPrivkeyHex,
                senderPubkeyHex: this.senderPubkeyHex,
                recipientPubkeyHex: recipientPubkey,
                content: text,
            });
        } else {
            // Group message
            return this.transport.sendGroupMessage({
                senderPrivkeyHex: this.senderPrivkeyHex,
                senderPubkeyHex: this.senderPubkeyHex,
                groupId: this.conversation.id,
                memberPubkeys: this.conversation.members.filter(
                    (pk) => pk !== this.senderPubkeyHex
                ),
                content: text,
            });
        }
    }
}

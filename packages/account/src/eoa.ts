import { type WalletClient, type PublicClient, type Address, type Chain, type Transport, type Hash, type Hex, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export type EOAWalletClient = WalletClient & {
    sendTransaction: (args: { to: Address, value?: bigint, data?: Hex }) => Promise<Hash>;
    getAddress: () => Address;
};

export const createEOAWalletClient = (
    privateKey: Hex, 
    chain: Chain, 
    transport: Transport = http()
): EOAWalletClient => {
    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
        account,
        chain,
        transport
    });

    return Object.assign(client, {
        async sendTransaction(args: { to: Address, value?: bigint, data?: Hex }) {
            return client.sendTransaction({
                ...args,
                account,
                chain
            });
        },
        getAddress: () => account.address
    }) as EOAWalletClient;
};

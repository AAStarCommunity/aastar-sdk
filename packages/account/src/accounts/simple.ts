import { 
    type Address, 
    type Hex, 
    type LocalAccount, 
    type SignableMessage, 
    type TypedDataDefinition,
    type Hash,
    concatHex, 
    encodeFunctionData, 
    keccak256,
} from 'viem';
import { SimpleAccountFactoryABI, type PublicClient } from '@aastar/core';
import { getUserOpHash } from '../index.js';

export type SimpleSmartAccount = LocalAccount & {
    signUserOperation: (userOp: any) => Promise<Hex>;
    getInitCode: () => Promise<Hex>;
    getDummySignature: () => Promise<Hex>;
    entryPoint: Address;
};

export async function toSimpleSmartAccount(parameters: {
    client: any;
    owner: LocalAccount;
    factoryAddress: Address;
    entryPoint: { address: Address; version: '0.6' | '0.7' };
    salt?: bigint;
    index?: bigint;
}): Promise<SimpleSmartAccount> {
    const { client, owner, factoryAddress, entryPoint, index = 0n, salt = 0n } = parameters;
    
    // Calculate initCode
    const factoryData = encodeFunctionData({
        abi: SimpleAccountFactoryABI,
        functionName: 'createAccount',
        args: [owner.address, salt]
    });
    const initCode = concatHex([factoryAddress, factoryData]);

    // Calculate counterfactual address
    const address = await client.readContract({
         address: factoryAddress,
         abi: SimpleAccountFactoryABI,
         functionName: 'getAddress',
         args: [owner.address, salt]
    });

    return {
        address,
        publicKey: owner.address,
        source: 'custom', 
        type: 'local',
        entryPoint: entryPoint.address,
        
        async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
            // validating signature for smart account usually involves EIP-1271, 
            // but here we just sign with owner for SimpleAccount which validates owner sig
            return owner.signMessage({ message });
        },

        async signTypedData(typedData: TypedDataDefinition): Promise<Hex> {
            return owner.signTypedData(typedData);
        },

        async signTransaction(transaction: any): Promise<Hex> {
            throw new Error('Smart Accounts cannot sign transactions directly. Use UserOperations.');
        },
        
        async signUserOperation(userOp: any): Promise<Hex> {
            const chainId = client.chain?.id || 31337; // Default to local anvil if not found
            const hash = getUserOpHash(userOp, entryPoint.address, chainId);
            return owner.signMessage({ message: { raw: hash } });
        },
        
        async getInitCode() {
            return initCode;
        },

        async getDummySignature() {
            return '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        }

    } as any as SimpleSmartAccount;
}

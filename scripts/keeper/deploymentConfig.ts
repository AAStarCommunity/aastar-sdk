/**
 * Secret-free deployment addresses. Only the named address fields are copied.
 * A missing file or a non-address value is skipped. Keys and other fields are ignored.
 */
import { constants } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import { getAddress, isAddress, type Address } from 'viem';

export const DEPLOYMENT_ADDRESS_FIELDS = [
    'superPaymaster',
    'paymasterV4',
    'priceFeed',
    'registry',
    'paymasterFactory',
] as const;

export type DeploymentAddressField = (typeof DEPLOYMENT_ADDRESS_FIELDS)[number];
export type DeploymentAddresses = Partial<Record<DeploymentAddressField, Address>>;

const MAX_FILE_BYTES = 1_000_000;

function copyAddress(value: unknown): Address | null {
    if (typeof value !== 'string' || value.length !== 42) return null;
    if (!isAddress(value)) return null;
    return getAddress(value);
}

/** Bounded field pick. Does not walk unknown keys. */
export function pickDeploymentAddresses(text: string): DeploymentAddresses {
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_FILE_BYTES) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return {};
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: DeploymentAddresses = {};
    for (const field of DEPLOYMENT_ADDRESS_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(parsed, field)) continue;
        const addr = copyAddress((parsed as Record<string, unknown>)[field]);
        if (addr) out[field] = addr;
    }
    return out;
}

/** Regular file only. FIFO and symlink opens fail closed and return nothing. */
export async function readDeploymentAddresses(filePath: string): Promise<DeploymentAddresses> {
    if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > 4_096) return {};
    let fh: FileHandle;
    try {
        fh = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    } catch {
        return {};
    }
    try {
        const st = await fh.stat();
        if (!st.isFile() || st.size < 0 || st.size > MAX_FILE_BYTES) return {};
        const text = await fh.readFile({ encoding: 'utf8' });
        return pickDeploymentAddresses(text);
    } catch {
        return {};
    } finally {
        await fh.close();
    }
}

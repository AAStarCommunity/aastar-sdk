import type {
    PaymentPayload,
    PaymentRequirements,
    VerifyResponse,
    SettleResponse,
    FacilitatorSupported,
    FacilitatorConfig,
} from './types.js';

/**
 * HTTP Facilitator Client — standard x402 v2 facilitator API.
 * Compatible with Coinbase hosted facilitator and self-hosted instances.
 *
 * Ref: coinbase/x402 HTTPFacilitatorClient pattern
 */
export class FacilitatorClient {
    private readonly url: string;
    private readonly createAuthHeaders: FacilitatorConfig['createAuthHeaders'];

    constructor(config: FacilitatorConfig) {
        this.url = config.url.replace(/\/$/, '');
        this.createAuthHeaders = config.createAuthHeaders;
    }

    private async getHeaders(endpoint: 'verify' | 'settle' | 'supported'): Promise<Record<string, string>> {
        const base: Record<string, string> = { 'Content-Type': 'application/json' };
        if (!this.createAuthHeaders) return base;
        const auth = await this.createAuthHeaders();
        return { ...base, ...auth[endpoint] };
    }

    /**
     * POST /verify — validate payment signature off-chain (~100ms).
     */
    async verify(
        paymentPayload: PaymentPayload,
        paymentRequirements: PaymentRequirements,
    ): Promise<VerifyResponse> {
        const resp = await fetch(`${this.url}/verify`, {
            method: 'POST',
            headers: await this.getHeaders('verify'),
            body: JSON.stringify({
                x402Version: 2,
                paymentPayload,
                paymentRequirements,
            }),
        });
        if (!resp.ok) {
            throw new Error(`Facilitator /verify failed: ${resp.status} ${await resp.text()}`);
        }
        return resp.json() as Promise<VerifyResponse>;
    }

    /**
     * POST /settle — execute on-chain settlement (~2s on Base).
     */
    async settle(
        paymentPayload: PaymentPayload,
        paymentRequirements: PaymentRequirements,
    ): Promise<SettleResponse> {
        const resp = await fetch(`${this.url}/settle`, {
            method: 'POST',
            headers: await this.getHeaders('settle'),
            body: JSON.stringify({
                x402Version: 2,
                paymentPayload,
                paymentRequirements,
            }),
        });
        if (!resp.ok) {
            throw new Error(`Facilitator /settle failed: ${resp.status} ${await resp.text()}`);
        }
        return resp.json() as Promise<SettleResponse>;
    }

    /**
     * GET /supported — query facilitator capabilities.
     */
    async supported(): Promise<FacilitatorSupported> {
        const resp = await fetch(`${this.url}/supported`, {
            method: 'GET',
            headers: await this.getHeaders('supported'),
        });
        if (!resp.ok) {
            throw new Error(`Facilitator /supported failed: ${resp.status} ${await resp.text()}`);
        }
        return resp.json() as Promise<FacilitatorSupported>;
    }
}

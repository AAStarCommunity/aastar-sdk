// Server-side email utility (Resend API wrapper). Exposed ONLY at the dedicated
// subpath `@aastar/sdk/email` — NOT re-exported from the root barrel — because it
// pulls in `resend` (an optional peer dep) and is meaningful only server-side /
// in agents. Same reasoning as the React-only `@aastar/sdk/dapp` subpath.
export * from '@aastar/email';

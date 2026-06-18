// Browser shim for Node's `module` builtin.
//
// The published `@aastar/sdk` bundle imports `createRequire` from `module` to support
// an OPT-IN local-config loader (only runs when `process.env.AASTAR_LOAD_LOCAL_CONFIG`
// is set, which never happens in the browser). We never want that path in a browser
// build, so `createRequire` here returns a no-op `require` that yields an empty module.
export function createRequire(_url?: string | URL) {
  const req = (_id: string): unknown => ({});
  return req as unknown as NodeRequire;
}

export default { createRequire };

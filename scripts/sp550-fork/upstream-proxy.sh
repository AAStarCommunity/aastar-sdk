# Sourced by run-a7.sh and setup-fork.sh (Daybreak #468 M3). start_upstream_proxy <port> <out dir>:
# moves the fork source out of every child's argv and environment. It reads SP550_FORK_URL (or the public default)
# into a shell variable, UNSETS the exported variable so no later child inherits it, pipes the URL to
# upstream-proxy.mjs on stdin (printf is a builtin: no argv), and sets UPSTREAM=http://127.0.0.1:<port>.
# Everything after this uses $UPSTREAM; the real URL appears in no argv, env, log or evidence file.
start_upstream_proxy() {
  local port="$1" out="$2" url
  url="${SP550_FORK_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
  unset SP550_FORK_URL FORK_URL
  printf '%s\n' "$url" | node "$(dirname "${BASH_SOURCE[0]}")/upstream-proxy.mjs" "$port" > "$out/upstream-proxy.log" 2>&1 &
  echo $! > "$out/upstream-proxy.pid"
  url=''
  for _ in $(seq 1 30); do grep -q "^READY $port\$" "$out/upstream-proxy.log" 2>/dev/null && break; sleep 0.5; done
  grep -q "^READY $port\$" "$out/upstream-proxy.log" || { echo "upstream proxy did not start (upstream-proxy.log)" >&2; return 1; }
  UPSTREAM="http://127.0.0.1:$port"
}

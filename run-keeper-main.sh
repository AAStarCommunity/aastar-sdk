pnpm exec tsx scripts/keeper.ts \
  --network op-mainnet \
  --external-ethusd-url "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT" \
  --poll-interval 180 \
  --safety-margin 600 \
  --mode cast \
  --cast-account optimism-deployer \
  --health-interval 1800 \
  --volatility-threshold-bps 150 \
  --volatility-cooldown 600

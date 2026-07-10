<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ArborWallet — Project Rules & Conventions

- **Authentication System**: We use **Firebase Authentication** as the identity layer (supporting Email/Password and Google Sign-In). GitHub and Telegram options have been completely removed.
- **Wallet Architecture**: We use **Magic Server Wallet (TEE)**. Do not import Magic SDK client-side for signing. Instead, auth is done via Firebase, and the Firebase JWT is sent to the backend `/api/wallet/create` or `/api/wallet/address` routes which call the Magic TEE API using the server's `MAGIC_SECRET_KEY` and the `OIDC_PROVIDER_ID`.
- **EVM Network**: The app runs on **Arbitrum Sepolia Testnet (Chain ID: 421614)**.
- **Dynamic Balances**: Saldo/angka keuangan are not hardcoded. Native ETH balances are fetched directly from the Arbitrum Sepolia RPC (`https://sepolia-rollup.arbitrum.io/rpc`) using the `getArbitrumSepoliaBalance` helper in `@/lib/format`.
- **Equality/No Caste**: The CFO/Employee role selector and UI badges have been removed. All users have equal status (`role: "employee"` under the hood).
- **Settings Page**: Users can check their public address, real-time balance, and enclave private key status in `/settings`.

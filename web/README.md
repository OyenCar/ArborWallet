This is the ArborWallet frontend app built with Next.js.

## Fix applied

- Corrected `src/app/login/page.tsx`, which previously contained the wrong page implementation and rendered a black blank screen.
- Updated the `/login` page layout to match the app’s other pages: same heading hierarchy, spacing, and card styling.
- The login route now renders `MagicLoginComponent` so users can enter email and authenticate via Magic Link.
- Ensured the app still uses the existing `AuthProvider` + `MagicProvider` stack from `src/app/layout.tsx`.
- Fixed client-side Magic provider env names to accept `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` and fallback to `NEXT_PUBLIC_MAGIC_API_KEY`.

## Environment variables

Create a `web/.env.local` file with these values:

```env
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_YOUR_MAGIC_PUBLISHABLE_KEY
MAGIC_SECRET_KEY=sk_live_YOUR_MAGIC_SECRET_KEY
```

- `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY`: frontend Magic publishable key.
- `MAGIC_SECRET_KEY`: server-side Magic secret key.

This project uses Magic as its primary identity provider. It does not require `MAGIC_PROVIDER_ID` or BYOA/OIDC provider configuration for the current login flow.

After login, the wallet address is obtained directly from Magic SDK. If `magic.user.getInfo()` does not immediately provide `publicAddress`, the app falls back to `web3.eth.getAccounts()` and then opens Magic Wallet UI with `magic.wallet.connectWithUI()` if needed.

If you see an error about missing environment variables, make sure the above keys are set in `web/.env.local`.

### Login persistence

The app stores the Magic token in `localStorage` under `auth_token` after login. If the page reloads, the auth provider reuses that token to restore the authenticated session automatically.

## Run the app

From the `web/` folder:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000/login`.

## Notes

- Make sure `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` and `MAGIC_SECRET_KEY` are configured in your environment.
- The backend API routes are included under `src/app/api/` and run inside Next.js.

## Wallet provisioning after login

This project uses Magic Auth standard flow.

- After Magic login succeeds, the client reads the wallet address from Magic SDK using `magic.user.getInfo()`.
- The returned `publicAddress` is passed to `/api/auth/link-social`.
- The server stores `socialId` → `address` in the database.

This means you do not need `MAGIC_PROVIDER_ID`, OIDC provider setup, or the external `tee.express.magiclabs.com` wallet creation call.

## What was fixed

- Corrected broken imports in `src/app/login/page.tsx`.
- The login page previously tried to import from `../app/components/index` and `../app/context/UserContext`, which were wrong paths.
- The page now imports the Magic login components directly from `@/components/*` and the user context from `@/app/context/UserContext`.
- This fix makes the Magic login components load and renders the login flow without module-not-found errors.

## Backend status

- The backend logic is integrated into this Next.js app as API routes under `src/app/api/`.
- There is no separate Express server in this repo; the backend runs inside `next dev`.
- Example backend routes include:
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/link-social/route.ts`
  - `src/app/api/users/me/route.ts`

## Run the app

From the `web/` folder:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Notes

- Make sure your `.env` file contains the Magic publishable key for the frontend and any required server-side secrets.
- If you want a standalone backend later, you can extract the API route logic from `src/app/api/*` into a separate server.

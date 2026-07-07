# ArborWallet — Frontend Design Prompt

> Source of truth for all UI/UX decisions. Supersedes any earlier crypto-native
> brutalist direction. Paste-ready for AI UI tools (v0, Lovable, Figma AI,
> Claude Code, Cursor) and binding for hand-built screens.

## Design Philosophy

Design ArborWallet as if **Stripe built a corporate treasury platform on
blockchain**.

- Do not design a crypto wallet.
- Do not design a DeFi dashboard.
- Do not make users feel like they are interacting with Web3.

The blockchain is infrastructure — not the product. The product is corporate
finance. Every design decision should communicate four emotions: **Trust,
Clarity, Control, Speed**.

The user should immediately understand: *"This is where my company's money
lives"* — not *"this is a crypto wallet."*

## Product Vision

ArborWallet is a treasury operating system for modern companies. Instead of
sending money manually through banks, spreadsheets, reimbursements, and
corporate cards, companies allocate budgets into programmable partitions.
Each employee receives **spending permission — not custody**. The owner always
retains full control.

Blockchain provides auditability, automation, instant settlement, and
programmable permissions. Users never need to understand blockchain.

## Personas

**1. Finance Manager / CFO / Founder (primary).** Runs payroll, approves
expenses, controls budgets, needs visibility. Does not care about blockchain.
Asks: How much budget remains? Who spent money? Which department exceeded
limits? Can I revoke access immediately? Did payroll execute?
Success = everything understandable in under 5 seconds.

**2. Employee.** Needs company funds, uploads invoices, pays vendors. Never
manages private keys, never changes networks, never worries about gas.
Success = "Getting company money feels like using Apple Pay."

**3. Merchant.** Shows a QR or scans one, receives payment, leaves. Nothing
else. No account, no onboarding.

## Product Personality

Imagine Stripe + Linear + Apple Wallet + Notion + Mercury Bank collaborated,
with a subtle neo-brutalist visual language.

Not: OpenSea, MetaMask, Phantom, Uniswap, TradingView. Avoid anything that
resembles crypto trading.

## UX Principles

Hide complexity. Reveal confidence. Never reveal infrastructure unless
requested.

| BAD (never in primary flows) | GOOD |
|---|---|
| Session Key Active | Permission Verified |
| ERC-4337 / Bundler / Paymaster | (invisible) |
| Magic Login | Authenticated |
| Gas Sponsored | No Network Fee |
| Sign UserOperation | Confirm Payment |
| ERC-4337 Wallet | Smart Company Account |
| Paymaster Enabled | Company Covers Network Fees |

### The "View Infrastructure" panel (judge-facing, first-class UI)

Advanced details live inside one deliberate, polished expandable panel per key
flow — labeled **View Infrastructure**. It is NOT a debug dump: designed with
the same care as the rest of the app (typography, spacing, status chips).
Shows: Magic authentication, ZeroDev smart account + session key scope,
ERC-4337 UserOp hash, paymaster sponsorship, Particle Universal Account
(deposits), Gelato automation, Pinata IPFS CID, Arbitrum network, gas.
Purpose: hackathon judges (ZeroDev subtrack) can see the tech live during the
demo with one click, while normal users never encounter it.

## Information Architecture

Navigation: `Dashboard · Budgets · Payments · Activity · Company · Settings`

NOT: Wallet, Gas, Networks, Tokens, Signatures, Contracts.

## Dashboard Layout

Calm. Large whitespace. One dominant number; everything else supports it.

```
Company Treasury
$482,350.24        [⇄ ETH]

────────────────────────
Marketing   $42,000
Payroll     $120,000
Operations  $18,500
Emergency   $15,000
────────────────────────
Pending Approvals
Upcoming Payroll
Recent Activity
```

Eye travel: Headline → Budgets → Primary Action → Activity → Secondary info.

### Currency display

Fiat by default, **one-tap toggle to ETH** next to every major balance.
On-chain values stay wei; conversion is display-only via a backend-cached
price feed. The toggle is global (persists across screens).

## Visual Hierarchy

Use typography instead of decoration. Every screen has exactly one focal
point. Never let two elements compete.

## Design Language — Product Neo-Brutalism

Minimal neo-brutalism. Not artistic neo-brutalism — *product* neo-brutalism.

Large spacing. Sharp borders. Confident typography. Hard shadows. Minimal
colors. No gradients, no glassmorphism, no skeuomorphism, no floating blobs,
no excessive illustrations.

## Color System

| Role | Hex | Usage |
|---|---|---|
| Background | `#FAFAF8` | off-white, not pure white |
| Surface | `#FFFFFF` | cards only |
| Primary text | `#161616` | near black |
| Secondary text | `#6B7280` | muted gray |
| Border | `#202020` | 2px solid |
| **Primary accent** | `#12AAFF` | Arbitrum Blue — primary CTA, current budget, selection, positive indicators. Use sparingly; never color the whole interface blue |
| Success | `#0E9F6E` | |
| Warning | `#F59E0B` | |
| Danger | `#D92D20` | rejected / revoked / expired / over limit only |

## Typography

- **Primary:** Inter or Geist — bold, large, confident.
- **Technical data:** JetBrains Mono — ONLY for wallet addresses, hashes,
  timestamps, technical IDs. Never for normal paragraphs.
- **Scale:** Hero 64–72px · Section 32px · Card title 18px · Body 16px ·
  Caption 13px.

## Components

- **Buttons:** rectangle, 2px border, hard shadow, minimal radius. Hover =
  shadow shifts. No glow.
- **Cards:** generous padding, simple, don't over-segment.
- **Tables:** Stripe-like — readable, minimal gridlines, excellent spacing.
- **Status chips:** Permission Granted · Pending Approval · Expired · Paid ·
  Rejected. Small, never oversized.

## Motion

Motion communicates state, never decoration. Under 250 ms. No bouncing, no
elastic easing.

- Budget increases → count animation
- Payment success → card expands
- Approval → stamp animation
- QR generated → quick scale

## Screens

### 1. Dashboard
Understand company financial health in 5 seconds. Treasury balance (fiat/ETH
toggle), department budgets, pending approvals, upcoming payroll, recent
activity. Primary CTAs: Create Budget, Transfer Funds.

### 2. Budget Detail
Remaining funds, assigned employees, monthly limit, recent payments, quick
actions.

### 3. Withdraw Funds (employee)
Select budget → amount → invoice upload → permission check → review → success.
Should feel like Apple Pay, not MetaMask.

### 4a. Pay a Merchant — scan-to-pay (employee)
Employee opens camera in-app, scans the merchant's static address QR
(EIP-681), amount + invoice attach, confirm, done. Merchant needs no account —
they just display their QR (any wallet address; Magic login on the spot if
they have none).

### 4b. Request-to-claim QR (employee generates)
Employee generates a payment-request QR: large QR, clear amount, visible
countdown (intent expiry). Payee scans → minimal claim page → supplies or
connects a receiving address → confirmation. Claim page carries the same
design system but zero navigation — single purpose, single action.

### 5. Activity
Beautiful table, human readable — not a blockchain explorer. Columns: Time,
Employee, Department, Description, Amount, Status. Hidden expandable row:
transaction hash, network, IPFS invoice (part of the View Infrastructure
pattern).

### 6. Company Settings
Budget management, employee permissions, spending limits, automation, payroll
schedules, emergency freeze. Everything operational, nothing
blockchain-heavy.

## Tone of Voice

Professional. Friendly. Direct. Never crypto-native.

Error states are plain finance language: "This budget is empty",
"Your spending permission expired — ask your admin", "An invoice is required
for every payment".

## Final Goal

A CFO should describe ArborWallet as: *"The easiest treasury software we've
ever used."*

A blockchain engineer should describe it as: *"An elegant abstraction over
ERC-4337, Magic, ZeroDev, Particle, Gelato, Pinata, and Arbitrum."*

If both statements are true, the design has succeeded.

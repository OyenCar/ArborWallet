import type { FundRequest, Partition, Tx, User } from "../types";
import { ethToWei } from "../format";

export const MOCK_ETH_USD = 3200;

export const mockUser: User = {
  socialId: "@sarah.cfo",
  address: "0x71C7656EC7ab88b098defB751B7401B5f6d89e2A",
  role: "owner",
};

export const mockVaultTotalWei = ethToWei(150.7345);

export const mockPartitions: Partition[] = [
  {
    id: "p1",
    onChainId: 1,
    label: "Marketing",
    isBackup: false,
    balanceWei: ethToWei(13.125),
    dueDate: null,
    members: [
      {
        socialId: "@budi",
        address: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B",
        limitWei: ethToWei(3),
        spentWei: ethToWei(1.2),
      },
      {
        socialId: "@rina",
        address: "0x2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B1c",
        limitWei: ethToWei(2),
        spentWei: ethToWei(1.95),
      },
    ],
  },
  {
    id: "p2",
    onChainId: 2,
    label: "Payroll",
    isBackup: false,
    balanceWei: ethToWei(37.5),
    dueDate: "2026-07-25T09:00:00Z",
    members: [
      {
        socialId: "@budi",
        address: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B",
        limitWei: ethToWei(5),
        spentWei: "0",
      },
      {
        socialId: "@rina",
        address: "0x2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B1c",
        limitWei: ethToWei(5),
        spentWei: "0",
      },
      {
        socialId: "@agus",
        address: "0x3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B1c2D",
        limitWei: ethToWei(5),
        spentWei: "0",
      },
    ],
  },
  {
    id: "p3",
    onChainId: 3,
    label: "Operations",
    isBackup: false,
    balanceWei: ethToWei(5.78125),
    dueDate: null,
    members: [
      {
        socialId: "@agus",
        address: "0x3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B1c2D",
        limitWei: ethToWei(1.5),
        spentWei: ethToWei(0.4),
      },
    ],
  },
  {
    id: "p4",
    onChainId: 4,
    label: "Emergency",
    isBackup: true,
    balanceWei: ethToWei(4.6875),
    dueDate: null,
    members: [],
  },
];

export const mockFundRequests: FundRequest[] = [
  {
    id: "fr1",
    partitionId: "p1",
    socialId: "@rina",
    amountWei: ethToWei(1),
    reason: "Q3 conference booth deposit exceeds my remaining limit",
    status: "pending",
    requestedAt: "2026-07-06T08:30:00Z",
  },
  {
    id: "fr2",
    partitionId: "p3",
    socialId: "@agus",
    amountWei: ethToWei(0.5),
    reason: "Server hardware replacement",
    status: "approved",
    requestedAt: "2026-07-02T14:10:00Z",
  },
];

export const mockTxs: Tx[] = [
  {
    id: "t1",
    txHash: "0x8f2e1a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f",
    partitionId: "p1",
    partitionLabel: "Marketing",
    socialId: "@budi",
    amountWei: ethToWei(0.8),
    type: "qr_pay",
    status: "paid",
    description: "Print vendor — booth banners",
    timestamp: "2026-07-06T10:22:00Z",
    invoiceCid: "QmX7b9tZnK3vR4sW2pL8mN5qJ6hF1dC0eA9gB8yU7iO6p",
  },
  {
    id: "t2",
    txHash: "0x7e1d0a8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
    partitionId: "p1",
    partitionLabel: "Marketing",
    socialId: "@rina",
    amountWei: ethToWei(0.45),
    type: "withdraw",
    status: "paid",
    description: "Social media ads July",
    timestamp: "2026-07-05T16:05:00Z",
    invoiceCid: "QmY8c0uAoL4wS5tX3qM9nO6rK7iG2eD1fB0hC9zV8jP7q",
  },
  {
    id: "t3",
    txHash: "0x6d0c9a7b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f",
    partitionId: "p2",
    partitionLabel: "Payroll",
    socialId: "@system",
    amountWei: ethToWei(15),
    type: "release",
    status: "paid",
    description: "June payroll auto-release (3 recipients)",
    timestamp: "2026-06-25T09:00:00Z",
  },
  {
    id: "t4",
    txHash: "0x5c9b8a6d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
    partitionId: "p3",
    partitionLabel: "Operations",
    socialId: "@agus",
    amountWei: ethToWei(0.4),
    type: "withdraw",
    status: "paid",
    description: "Cloud infra invoice June",
    timestamp: "2026-06-28T11:45:00Z",
    invoiceCid: "QmZ9d1vBpM5xT6uY4rN0oP7sL8jH3fE2gC1iD0aW9kQ8r",
  },
  {
    id: "t5",
    txHash: "0x4b8a7c5d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
    partitionId: "p1",
    partitionLabel: "Marketing",
    socialId: "@sarah.cfo",
    amountWei: ethToWei(13.125),
    type: "deposit",
    status: "paid",
    description: "Q3 budget allocation",
    timestamp: "2026-07-01T08:00:00Z",
  },
];

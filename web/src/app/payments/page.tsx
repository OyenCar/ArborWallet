import Link from "next/link";

const actions = [
  {
    href: "/payments/withdraw",
    title: "Withdraw Funds",
    desc: "Take funds from a budget you belong to. Invoice required.",
  },
  {
    href: "/payments/pay",
    title: "Pay a Vendor",
    desc: "Scan the vendor's QR code and pay them directly from your budget.",
  },
  {
    href: "/payments/request",
    title: "Request Payment QR",
    desc: "Generate a time-limited QR someone can scan to receive a payment.",
  },
];

export default function Payments() {
  return (
    <div className="space-y-8">
      <h1 className="text-5xl font-extrabold tracking-tight">Payments</h1>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group border-2 border-line bg-surface p-6 shadow-hard transition-shift hover:shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            <h2 className="text-xl font-bold">{a.title}</h2>
            <p className="mt-2 text-sm text-muted">{a.desc}</p>
            <p className="mt-4 font-mono text-sm text-accent-text transition-transform duration-150 group-hover:translate-x-1.5">
              →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

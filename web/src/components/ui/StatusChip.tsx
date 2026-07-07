const styles: Record<string, string> = {
  paid: "bg-success/10 text-success-text border-success",
  approved: "bg-success/10 text-success-text border-success",
  granted: "bg-success/10 text-success-text border-success",
  active: "bg-success/10 text-success-text border-success",
  paused: "bg-muted/10 text-muted border-muted",
  pending: "bg-warning/10 text-warning-text border-warning",
  rejected: "bg-danger/10 text-danger border-danger",
  expired: "bg-danger/10 text-danger border-danger",
  revoked: "bg-danger/10 text-danger border-danger",
};

const labels: Record<string, string> = {
  paid: "Paid",
  approved: "Approved",
  granted: "Permission Granted",
  active: "Active",
  paused: "Paused",
  pending: "Pending Approval",
  rejected: "Rejected",
  expired: "Expired",
  revoked: "Revoked",
};

export function StatusChip({ status }: { status: string }) {
  const s = styles[status] ?? "bg-muted/10 text-muted border-muted";
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-xs font-medium ${s}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

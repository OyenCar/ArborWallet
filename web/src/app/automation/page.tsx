import { AutomationCalendar } from "@/components/AutomationCalendar";
import { Button } from "@/components/ui/Button";
import { ViewInfrastructure } from "@/components/ViewInfrastructure";

export default function AutomationPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight">Automation</h1>
          <p className="mt-2 text-muted">
            Scheduled and condition-triggered rules that move money without
            anyone signing in.
          </p>
        </div>
        <Button variant="primary">New Automation</Button>
      </div>

      <AutomationCalendar />

      <ViewInfrastructure
        rows={[
          { label: "Executor", value: "Gelato Web3 Functions (permissionless)" },
          { label: "Scheduled release", value: "releaseVault(partitionId) @ dueDate" },
          { label: "Low-balance top-up", value: "balance condition → topUp(from, to, amount)" },
          { label: "Recurring payment", value: "time trigger → withdraw() via owner session key" },
          { label: "Limit reset", value: "time trigger → resetSpent(partitionId)" },
        ]}
      />
    </div>
  );
}

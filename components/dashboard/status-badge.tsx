import { Badge } from "@/components/ui/badge";
import { appStatusTone, payStatusTone } from "@/lib/status-tone";

/** Application status as a pill. Unknown values render "Unknown", never blank. */
export function AppStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const { tone, label } = appStatusTone(status);
  return <Badge variant={tone} className={className}>{label}</Badge>;
}

export function PayStatusBadge({ payment, className }: { payment: string | null | undefined; className?: string }) {
  const { tone, label } = payStatusTone(payment);
  return <Badge variant={tone} className={className}>{label}</Badge>;
}

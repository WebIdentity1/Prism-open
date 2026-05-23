import { differenceInDays } from "date-fns";

export type ClientSegment = "new" | "active" | "at_risk" | "lapsed" | "vip";

export interface SegmentInfo {
  label: string;
  color: string;
  description: string;
}

export const SEGMENTS: Record<ClientSegment, SegmentInfo> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", description: "First visit within 30 days" },
  active: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", description: "Visited within last 60 days" },
  at_risk: { label: "At-Risk", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", description: "No visit in 60-120 days" },
  lapsed: { label: "Lapsed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", description: "No visit in 120+ days" },
  vip: { label: "VIP", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", description: "10+ visits or $500+ spend" },
};

export function computeSegment(
  appointmentCount: number,
  totalSpend: number,
  lastVisitDate: string | null,
  firstVisitDate: string | null,
): ClientSegment {
  const now = new Date();

  // VIP: high value clients
  if (appointmentCount >= 10 || totalSpend >= 500) return "vip";

  if (!lastVisitDate) return "new";

  const daysSinceLastVisit = differenceInDays(now, new Date(lastVisitDate));
  const daysSinceFirstVisit = firstVisitDate ? differenceInDays(now, new Date(firstVisitDate)) : 0;

  // New: first visit within 30 days
  if (appointmentCount <= 2 && daysSinceFirstVisit <= 30) return "new";

  // Active: visited within 60 days
  if (daysSinceLastVisit <= 60) return "active";

  // At-risk: 60-120 days
  if (daysSinceLastVisit <= 120) return "at_risk";

  // Lapsed: 120+ days
  return "lapsed";
}

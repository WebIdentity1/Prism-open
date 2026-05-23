// Dynamic pricing helper

export interface SurgeRule {
  day_of_week: number; // 0=Sun, 1=Mon, ..., 6=Sat
  start_hour: number;
  end_hour: number;
  multiplier: number; // e.g. 1.2 = +20%
}

export interface OffpeakRule {
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  discount_pct: number; // e.g. 15 = -15%
}

export interface PriceAdjustment {
  finalPrice: number;
  label: string | null; // e.g. "Peak +20%" or "Off-peak -15%"
  type: "surge" | "offpeak" | "normal";
}

export function getAdjustedPrice(
  basePrice: number,
  surgeEnabled: boolean,
  surgeRules: SurgeRule[],
  offpeakEnabled: boolean,
  offpeakRules: OffpeakRule[],
  selectedDate: Date,
  selectedTime: string // "HH:mm"
): PriceAdjustment {
  const dow = selectedDate.getDay();
  const hour = parseInt(selectedTime.split(":")[0], 10);

  // Check surge first
  if (surgeEnabled && surgeRules.length > 0) {
    const match = surgeRules.find(
      (r) => r.day_of_week === dow && hour >= r.start_hour && hour < r.end_hour
    );
    if (match) {
      const pct = Math.round((match.multiplier - 1) * 100);
      return {
        finalPrice: Math.round(basePrice * match.multiplier * 100) / 100,
        label: `Peak +${pct}%`,
        type: "surge",
      };
    }
  }

  // Then check offpeak
  if (offpeakEnabled && offpeakRules.length > 0) {
    const match = offpeakRules.find(
      (r) => r.day_of_week === dow && hour >= r.start_hour && hour < r.end_hour
    );
    if (match) {
      return {
        finalPrice: Math.round(basePrice * (1 - match.discount_pct / 100) * 100) / 100,
        label: `Off-peak -${match.discount_pct}%`,
        type: "offpeak",
      };
    }
  }

  return { finalPrice: basePrice, label: null, type: "normal" };
}

export const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i === 0 ? "12" : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}`,
}));

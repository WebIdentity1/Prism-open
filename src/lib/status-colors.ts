/** Shared status → badge class mapping for appointments */
export const appointmentStatusColor: Record<string, string> = {
  booked: "badge-prism",
  confirmed: "badge-teal",
  completed: "badge-champagne",
  cancelled: "badge-rose",
  no_show: "bg-destructive/10 text-destructive",
};

/** Status colors for consultations */
export const consultationStatusColor: Record<string, string> = {
  draft: "badge-glass",
  submitted: "badge-prism",
  reviewed: "badge-teal",
  completed: "badge-champagne",
};

/** Status colors for campaigns */
export const campaignStatusColor: Record<string, string> = {
  draft: "badge-glass",
  sending: "badge-champagne",
  sent: "badge-teal",
};

/** Calendar/schedule views need border variants */
export const calendarStatusColor: Record<string, string> = {
  booked: "bg-primary/20 border-primary text-primary",
  confirmed: "bg-accent/50 border-accent text-accent-foreground",
  completed: "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400",
  cancelled: "bg-muted border-muted text-muted-foreground",
  no_show: "bg-destructive/10 border-destructive/30 text-destructive",
};

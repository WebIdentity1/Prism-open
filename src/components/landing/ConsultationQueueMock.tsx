const consultations = [
  {
    name: "Sarah M.",
    faceShape: "Oval",
    style: "Layered bob with curtain bangs",
    status: "Try-on image ready",
    statusColor: "text-glass-teal",
    time: null,
  },
  {
    name: "Marcus T.",
    faceShape: "Square",
    style: "Mid fade with textured crop",
    status: "Appointment today 2:30 PM",
    statusColor: "text-champagne",
    time: "2:30 PM",
  },
  {
    name: "Priya K.",
    faceShape: "Heart",
    style: "Long layers with face framing",
    status: "Consultation submitted",
    statusColor: "text-primary",
    time: null,
  },
];

export function ConsultationQueueMock() {
  return (
    <div className="glass rounded-2xl p-4 border border-primary/20">
      <div className="bg-obsidian/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-white/5">
          <div className="w-2 h-2 rounded-full bg-glass-teal" />
          <span className="text-xs text-muted-foreground">
            Consultation Queue
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/50">
            {consultations.length} pending
          </span>
        </div>

        {consultations.map((client) => (
          <div
            key={client.name}
            className="flex items-start gap-3 bg-white/[0.03] rounded-lg p-3"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-glass-teal/20 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {client.name} — {client.faceShape} face
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                Wants: {client.style}
              </p>
              <p className={`text-[10px] mt-1 ${client.statusColor}`}>
                {client.status}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-2">
        <span className="text-[9px] bg-primary text-white px-2 py-0.5 rounded-md font-medium">
          Live Preview
        </span>
      </div>
    </div>
  );
}

export function EmailBuilderMock() {
  return (
    <div className="bg-obsidian/80 rounded-lg p-3 w-full max-w-[220px] text-[10px] shrink-0">
      <p className="text-glass-teal font-medium mb-2">AI Email Builder</p>
      <div className="bg-white/[0.03] rounded p-2 text-muted-foreground mb-2 leading-relaxed">
        Prompt: &quot;Send a reminder to clients who haven&apos;t visited in 30
        days&quot;
      </div>
      <div className="bg-glass-teal/10 border border-glass-teal/20 rounded p-2 text-muted-foreground/80 leading-relaxed">
        Subject: We miss you at [Salon]...
        <br />
        <span className="text-glass-teal">Generating email...</span>
      </div>
    </div>
  );
}

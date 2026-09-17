export function EmptyState({ title }: { title: string }) {
  return (
    <section
      className="flex min-h-[60vh] flex-col items-center justify-center rounded-[var(--radius-card)] border p-10 text-center"
      style={{
        borderColor: "var(--stayo-border)",
        backgroundColor: "var(--stayo-surface)",
      }}
    >
      <h1
        className="text-2xl"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        {title}
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        Em construção
      </p>
    </section>
  );
}

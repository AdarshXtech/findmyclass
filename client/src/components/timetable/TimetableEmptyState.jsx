export default function TimetableEmptyState({ message, detail }) {
  return (
    <section className="rounded-lg border border-border-default bg-surface-primary px-5 py-8">
      <p className="font-display text-xl font-bold">{message}</p>
      {detail ? <p className="mt-1 text-sm text-text-secondary">{detail}</p> : null}
    </section>
  )
}

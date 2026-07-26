export default function TimetableEmptyState({ message, detail }) {
  return (
    <section className="border-y border-border-strong bg-surface-primary px-5 py-9">
      <p className="font-display text-xl font-bold">{message}</p>
      {detail ? <p className="mt-1 text-sm text-text-secondary">{detail}</p> : null}
    </section>
  )
}

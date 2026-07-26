export default function PageLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-5 text-text-primary">
      <div role="status" aria-live="polite" className="w-full max-w-sm border-y border-border-strong py-8">
        <p className="font-mono text-xs font-bold uppercase text-accent-primary">Loading</p>
        <p className="mt-2 font-display text-2xl font-bold">Opening page...</p>
      </div>
    </div>
  )
}

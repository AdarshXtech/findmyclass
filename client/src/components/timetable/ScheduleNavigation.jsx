export default function ScheduleNavigation({ activeView, onSelect, tabIndex }) {
  return (
    <div className="grid gap-2" aria-label="Schedule views">
      {[
        ['daily', 'Daily Classes'],
        ['weekly', 'Weekly Classes'],
      ].map(([view, label]) => (
        <button
          key={view}
          type="button"
          tabIndex={tabIndex}
          onClick={() => onSelect(view)}
          className={`flex min-h-11 items-center justify-between rounded-lg border px-4 py-3 text-left font-bold transition-colors ${
            activeView === view
              ? 'border-result-blue bg-result-blue-pale text-result-navy'
              : 'border-border-default bg-surface-primary text-text-secondary hover:border-result-blue'
          }`}
          aria-current={activeView === view ? 'page' : undefined}
        >
          <span>{label}</span>
          <span className={`h-2 w-2 rounded-full ${activeView === view ? 'bg-accent-primary' : 'bg-border-default'}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

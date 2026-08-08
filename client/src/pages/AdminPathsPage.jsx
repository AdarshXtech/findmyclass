import CampusPathEditor from '../components/map/CampusPathEditor'

export default function AdminPathsPage() {
  return (
    <section className="min-w-0">
      <div className="mb-6 border border-border-default bg-surface-primary p-5 shadow-admin sm:p-7">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">Campus navigation</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Path Editor</h1>
      </div>
      <CampusPathEditor />
    </section>
  )
}

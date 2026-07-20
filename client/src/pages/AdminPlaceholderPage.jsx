export default function AdminPlaceholderPage({ title, description }) {
  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-slate-400">{description}</p>
    </div>
  )
}

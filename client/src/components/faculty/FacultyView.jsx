import { HiOutlinePhone, HiOutlineUserGroup } from 'react-icons/hi'

function ContactCall({ contact, coordinator = false }) {
  return (
    <a
      href={`tel:${contact.phoneNumber}`}
      aria-label={`Call ${contact.name}`}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 font-bold transition-colors focus-visible:outline-none ${
        coordinator
          ? 'bg-surface-primary text-result-slate-dark hover:bg-result-slate-soft'
          : 'bg-result-slate text-text-on-dark hover:bg-result-slate-hover'
      }`}
    >
      <HiOutlinePhone aria-hidden="true" /> Call
    </a>
  )
}

function FacultyContact({ contact }) {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-lg border border-border-default bg-surface-primary p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-display text-lg font-bold [overflow-wrap:anywhere]">{contact.name}</h3>
        {contact.designation ? <p className="mt-1 text-sm text-text-secondary">{contact.designation}</p> : null}
        <a href={`tel:${contact.phoneNumber}`} className="mt-2 inline-block font-mono text-sm font-semibold text-result-slate-dark" aria-label={`Call ${contact.name} at ${contact.phoneNumber}`}>
          {contact.phoneNumber}
        </a>
      </div>
      <ContactCall contact={contact} />
    </article>
  )
}

export default function FacultyView({ contacts = [], section }) {
  const coordinator = contacts.find((contact) => contact.role === 'Coordinator')
  const faculty = contacts.filter((contact) => contact.role !== 'Coordinator')
  const coordinatorDesignation = coordinator?.designation?.toLowerCase() === 'class coordinator'
    ? null
    : coordinator?.designation

  return (
    <div className="min-w-0">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <HiOutlineUserGroup aria-hidden="true" className="text-2xl text-result-slate" />
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Faculty</h1>
        </div>
        <p className="mt-2 text-text-secondary">{section} · Faculty contacts for your class</p>
      </header>

      {coordinator ? (
        <article className="rounded-lg bg-result-slate-dark p-6 text-text-on-dark shadow-result sm:p-7">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-result-subtle">Class Coordinator</p>
          <div className="mt-4 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold [overflow-wrap:anywhere]">{coordinator.name}</h2>
              {coordinatorDesignation ? <p className="mt-2 text-sm text-result-subtle">{coordinatorDesignation}</p> : null}
              <a href={`tel:${coordinator.phoneNumber}`} className="mt-3 inline-block font-mono font-semibold text-text-on-dark" aria-label={`Call ${coordinator.name} at ${coordinator.phoneNumber}`}>
                {coordinator.phoneNumber}
              </a>
            </div>
            <ContactCall contact={coordinator} coordinator />
          </div>
        </article>
      ) : (
        <div className="rounded-lg border border-border-default bg-surface-primary p-6 text-text-secondary">
          Coordinator information has not been added yet.
        </div>
      )}

      <section className="mt-8" aria-labelledby="other-faculty-heading">
        <h2 id="other-faculty-heading" className="mb-4 font-mono text-xs font-bold uppercase tracking-wide text-text-secondary">Other Faculty</h2>
        {faculty.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {faculty.map((contact) => <FacultyContact key={contact.id} contact={contact} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-border-default bg-surface-primary p-6 text-text-secondary">
            No additional faculty contacts are available for your class.
          </div>
        )}
      </section>
    </div>
  )
}

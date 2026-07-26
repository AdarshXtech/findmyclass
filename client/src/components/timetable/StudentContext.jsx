import { formatSection, formatStudentName } from '../../utils/identityNormalization'

export default function StudentContext({ student, children }) {
  const displaySection = formatSection(student.section)

  return (
    <section className="border-b-2 border-border-strong pb-8">
      <p className="font-mono text-xs font-bold uppercase text-accent-primary">{displaySection} / Semester III</p>
      <div className="mt-4 grid min-w-0 gap-8 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-5xl">
            {formatStudentName(student.name)}
          </h1>
          <div className="mt-4 flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-text-secondary sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-2 sm:text-base">
            <p className="[overflow-wrap:anywhere]">{student.course} {student.branch}</p>
            <p>Year {student.year}</p>
            <p className="[overflow-wrap:anywhere]">Class {displaySection}</p>
          </div>
        </div>
        {children}
      </div>
    </section>
  )
}

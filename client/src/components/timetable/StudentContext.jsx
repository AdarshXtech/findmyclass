import { formatSection, formatStudentName } from '../../utils/identityNormalization'

export default function StudentContext({ student }) {
  const displaySection = formatSection(student.section)
  const course = [student.course, student.branch].filter(Boolean).join(' ')
  const year = String(student.year || '').replace(/^Year\s+/i, '')

  return (
    <section className="min-w-0 border-b border-border-default pb-7 md:border-b-0 md:pb-0">
      <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">{displaySection} / Semester III</p>
      <h1 className="mt-3 min-w-0 font-display text-2xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl xl:text-5xl">
        {formatStudentName(student.name)}
      </h1>
      <div className="mt-4 min-w-0 space-y-1 text-sm font-medium leading-5 text-text-secondary sm:text-base">
        <p className="[overflow-wrap:anywhere]">{course}</p>
        <p>Year {year}</p>
        <p className="[overflow-wrap:anywhere]">Class {displaySection}</p>
      </div>
    </section>
  )
}

import type { Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sanityFetch } from '@/lib/sanity/fetch'
import { projectsIndexQuery } from '@/lib/sanity/queries'
import { toProjectSummary } from '@/lib/projects/toProject'
import { ProjectsList } from '@/components/projects/ProjectsList'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './ProjectsView.module.css'

export async function ProjectsView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const raw = await sanityFetch({ query: projectsIndexQuery, tags: ['projects-index'] })
  const projects = (raw ?? []).map((p) => toProjectSummary(p, locale))

  return (
    <div className={styles.projects}>
      <h1 className={styles.heading}>{dict.navProjects}</h1>
      {projects.length === 0 ? (
        <EmptyState message={dict.emptyProjects} />
      ) : (
        <ProjectsList projects={projects} locale={locale} />
      )}
    </div>
  )
}

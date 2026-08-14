import { notFound } from 'next/navigation'
import type { Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sanityFetch } from '@/lib/sanity/fetch'
import { projectBySlugQuery } from '@/lib/sanity/queries'
import { toProjectDetail } from '@/lib/projects/toProject'
import { ProjectSequence } from '@/components/projects/ProjectSequence'
import styles from './ProjectView.module.css'

export async function ProjectView({
  locale,
  slug,
  preview = false,
}: {
  locale: Locale
  slug: string
  preview?: boolean
}) {
  const dict = getDictionary(locale)
  const raw = await sanityFetch({
    query: projectBySlugQuery,
    params: { slug },
    tags: [`project:${slug}`],
    preview,
  })

  const project = toProjectDetail(raw, locale)

  // Progetti inesistenti, rimossi o non pubblicati: 404 localizzata
  // (specifica di prodotto §6).
  if (!project) notFound()

  const langOf = (lang: Locale) => (lang === locale ? undefined : lang)

  return (
    <article className={styles.project}>
      <header className={styles.header}>
        <h1 className={styles.title} lang={langOf(project.titleLang)}>
          {project.title}
        </h1>
        {project.year ? <p className={styles.year}>{project.year}</p> : null}
        {project.description ? (
          <p className={styles.description} lang={langOf(project.descriptionLang)}>
            {project.description}
          </p>
        ) : null}
      </header>

      <ProjectSequence photos={project.photos} locale={locale} dict={dict} />
    </article>
  )
}

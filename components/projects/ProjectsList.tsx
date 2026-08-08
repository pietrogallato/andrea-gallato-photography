import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locales'
import { pathFor } from '@/lib/i18n/routes'
import type { ProjectSummary } from '@/lib/projects/toProject'
import { SanityImage } from '@/components/media/SanityImage'
import styles from './ProjectsList.module.css'

export function ProjectsList({
  projects,
  locale,
}: {
  projects: ProjectSummary[]
  locale: Locale
}) {
  return (
    <ul className={styles.list}>
      {projects.map((project, i) => (
        <li
          key={project.id}
          className={styles.item}
          style={{ '--i': String(i) } as React.CSSProperties}
        >
          <Link
            href={pathFor(locale, { key: 'project', slug: project.slug })}
            className={styles.link}
          >
            {project.cover ? (
              <span className={styles.cover}>
                <SanityImage
                  photo={{
                    url: project.cover.url,
                    aspectRatio: project.cover.ar,
                    lqip: project.cover.lqip,
                    alt: project.cover.alt,
                    altLang: project.cover.altLang,
                  }}
                  sizes="(max-width: 767px) 100vw, 50vw"
                  locale={locale}
                />
              </span>
            ) : null}

            <span className={styles.meta}>
              <span
                className={styles.title}
                lang={project.titleLang === locale ? undefined : project.titleLang}
              >
                {project.title}
              </span>
              {project.year ? <span className={styles.year}>{project.year}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

import { type Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pickLocalized } from '@/lib/i18n/localize'
import { sanityFetch } from '@/lib/sanity/fetch'
import { aboutPageQuery } from '@/lib/sanity/queries'
import { SanityImage } from '@/components/media/SanityImage'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './AboutView.module.css'

export async function AboutView({
  locale,
  siteName,
  preview = false,
}: {
  locale: Locale
  siteName: string
  preview?: boolean
}) {
  const dict = getDictionary(locale)
  const about = await sanityFetch({ query: aboutPageQuery, tags: ['about'] , preview })

  if (!about) {
    return <EmptyState message={dict.errorGeneric} />
  }

  const bio = pickLocalized({ it: about.bioIt, en: about.bioEn }, locale)
  const statement = pickLocalized({ it: about.statementIt, en: about.statementEn }, locale)

  const langOf = (lang: Locale) => (lang === locale ? undefined : lang)
  const social = (about.socialLinks ?? []).filter((l) => l?.url && l?.label)

  return (
    <div className={styles.about}>
      <h1 className={styles.title}>{siteName}</h1>

      <div className={styles.body}>
        {about.portraitUrl ? (
          <SanityImage
            photo={{
              url: about.portraitUrl,
              aspectRatio: about.portraitAr && about.portraitAr > 0 ? about.portraitAr : 0.8,
              lqip: about.portraitLqip,
              // Lo schema del ritratto non ha un campo alt: il testo si compone
              // dal dizionario e dal nome, quindi resta corretto e tradotto
              // senza chiedere all editor di scriverlo due volte.
              alt: `${dict.portraitOf} ${siteName}`,
              altLang: locale,
            }}
            sizes="(max-width: 767px) 100vw, 38vw"
            locale={locale}
            className={styles.portrait}
          />
        ) : null}

        <div className={styles.text}>
          {bio.value ? (
            <p className={styles.bio} lang={langOf(bio.lang)}>
              {bio.value}
            </p>
          ) : null}

          {statement.value ? (
            <section className={styles.section}>
              <h2 className={styles.heading}>{dict.aboutStatementHeading}</h2>
              <p lang={langOf(statement.lang)}>{statement.value}</p>
            </section>
          ) : null}

          {about.email || social.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.heading}>{dict.aboutContactHeading}</h2>
              <ul className={styles.contacts}>
                {about.email ? (
                  <li>
                    <a href={`mailto:${about.email}`} className={styles.contactLink}>
                      {about.email}
                    </a>
                  </li>
                ) : null}
                {social.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url!}
                      className={styles.contactLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

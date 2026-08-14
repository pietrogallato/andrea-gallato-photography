import { type Locale } from '@/lib/i18n/locales'
import { pickLocalized } from '@/lib/i18n/localize'
import { sanityFetch } from '@/lib/sanity/fetch'
import { homeHeroQuery } from '@/lib/sanity/queries'
import { toGalleryPhoto } from '@/lib/gallery/toGalleryPhoto'
import { SanityImage } from '@/components/media/SanityImage'
import styles from './HomeView.module.css'

export async function HomeView({
  locale,
  siteName,
  preview = false,
}: {
  locale: Locale
  siteName: string
  preview?: boolean
}) {
  const home = await sanityFetch({ query: homeHeroQuery, tags: ['home'] , preview })
  const hero = home?.heroPhoto ? toGalleryPhoto(home.heroPhoto, locale) : null

  const intro = pickLocalized({ it: home?.introIt, en: home?.introEn }, locale)
  const introLang = intro.lang === locale ? undefined : intro.lang

  if (!hero) {
    return (
      <div className={styles.fallback}>
        <h1>{siteName}</h1>
        {intro.value ? <p lang={introLang}>{intro.value}</p> : null}
      </div>
    )
  }

  return (
    <section className={`${styles.hero} surface-dark`}>
      <SanityImage
        photo={{
          url: hero.url,
          aspectRatio: hero.ar,
          lqip: hero.lqip,
          alt: hero.alt,
          altLang: hero.altLang,
        }}
        sizes="100vw"
        locale={locale}
        priority
        className={styles.heroImage}
      />

      {/* Velatura fissa e non dipendente dallo scatto: il testo in
          sovrimpressione deve avere un contrasto garantito qualunque
          fotografia il fotografo scelga come protagonista. */}
      <div className={styles.scrim} aria-hidden="true" />

      <div className={styles.content}>
        <h1 className={styles.title}>{siteName}</h1>
        {intro.value ? (
          <p className={styles.intro} lang={introLang}>
            {intro.value}
          </p>
        ) : null}
      </div>
    </section>
  )
}

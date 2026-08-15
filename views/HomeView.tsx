import Link from 'next/link'
import { type Locale } from '@/lib/i18n/locales'
import { pickLocalized } from '@/lib/i18n/localize'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pathFor } from '@/lib/i18n/routes'
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
  const dict = getDictionary(locale)

  if (!hero) {
    return (
      <div className={styles.fallback}>
        <h1>{siteName}</h1>
        {intro.value ? <p lang={introLang}>{intro.value}</p> : null}
      </div>
    )
  }

  return (
    <section className={styles.hero}>
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
          <p className={styles.intro} lang={introLang} data-testid="home-intro">
            {intro.value}
          </p>
        ) : null}
        <Link href={pathFor(locale, { key: 'gallery' })} className={styles.enter}>
          {dict.homeEnter}
          {/* Freccia orizzontale, mai verso il basso: sotto non c e nulla, e
              una freccia che promette scorrimento su una pagina che non scorre
              e il primo gesto che il visitatore tenta a vuoto. */}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}

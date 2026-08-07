import { type Locale } from '@/lib/i18n/locales'
import { pickLocalized } from '@/lib/i18n/localize'
import { sanityFetch } from '@/lib/sanity/fetch'
import { homeHeroQuery } from '@/lib/sanity/queries'
import { toGalleryPhoto } from '@/lib/gallery/toGalleryPhoto'
import { SanityImage } from '@/components/media/SanityImage'
import styles from './HomeView.module.css'

export async function HomeView({ locale, siteName }: { locale: Locale; siteName: string }) {
  const home = await sanityFetch({ query: homeHeroQuery, tags: ['home'] })
  const hero = home?.heroPhoto ? toGalleryPhoto(home.heroPhoto, locale) : null

  const intro = pickLocalized({ it: home?.introIt, en: home?.introEn }, locale)

  return (
    <div className={styles.home}>
      {hero ? (
        <div className={styles.hero}>
          <SanityImage
            photo={{ url: hero.url, aspectRatio: hero.ar, lqip: hero.lqip, alt: hero.alt, altLang: hero.altLang }}
            sizes="100vw"
            locale={locale}
            priority
          />
        </div>
      ) : null}

      <h1 className={styles.title}>{siteName}</h1>
      {intro.value ? (
        <p className={styles.intro} lang={intro.lang === locale ? undefined : intro.lang}>
          {intro.value}
        </p>
      ) : null}
    </div>
  )
}

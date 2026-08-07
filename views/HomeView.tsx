import { type Locale } from '@/lib/i18n/locales'
import { pickLocalized } from '@/lib/i18n/localize'
import { sanityFetch } from '@/lib/sanity/fetch'
import { homePageQuery } from '@/lib/sanity/queries'
import styles from './HomeView.module.css'

export async function HomeView({ locale, siteName }: { locale: Locale; siteName: string }) {
  const home = await sanityFetch({ query: homePageQuery, tags: ['home'] })

  const intro = pickLocalized({ it: home?.introIt, en: home?.introEn }, locale)

  return (
    <div className={styles.home}>
      <h1 className={styles.title}>{siteName}</h1>
      {intro.value ? (
        <p className={styles.intro} lang={intro.lang === locale ? undefined : intro.lang}>
          {intro.value}
        </p>
      ) : null}
    </div>
  )
}

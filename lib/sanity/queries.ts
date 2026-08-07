import { defineQuery } from 'next-sanity'

export const siteSettingsQuery = defineQuery(`
  *[_type == "siteSettings"][0]{
    photographerName,
    seoTitleIt, seoTitleEn,
    seoDescriptionIt, seoDescriptionEn,
    email
  }
`)

export const homePageQuery = defineQuery(`
  *[_type == "homePage"][0]{
    introIt, introEn
  }
`)

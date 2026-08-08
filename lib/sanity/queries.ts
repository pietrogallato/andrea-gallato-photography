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

const PHOTO_FIELDS = `
  _id,
  altIt, altEn,
  titleIt, titleEn,
  placeIt, placeEn,
  year,
  "url": image.asset->url,
  "aspectRatio": image.asset->metadata.dimensions.aspectRatio,
  "lqip": image.asset->metadata.lqip
`

export const galleryPageQuery = defineQuery(`
  *[_type == "photo" && showInGallery == true && defined(image.asset)]
    | order(orderRank asc)[$start...$end]{${PHOTO_FIELDS}}
`)

export const galleryCountQuery = defineQuery(`
  count(*[_type == "photo" && showInGallery == true && defined(image.asset)])
`)

export const homeHeroQuery = defineQuery(`
  *[_type == "homePage"][0]{
    introIt, introEn,
    "heroPhoto": heroPhoto->{${PHOTO_FIELDS}}
  }
`)

export const aboutPageQuery = defineQuery(`
  *[_type == "aboutPage"][0]{
    bioIt, bioEn,
    statementIt, statementEn,
    email,
    socialLinks[]{label, url},
    "portraitUrl": portrait.asset->url,
    "portraitAr": portrait.asset->metadata.dimensions.aspectRatio,
    "portraitLqip": portrait.asset->metadata.lqip
  }
`)

const PROJECT_PHOTO_FIELDS = `
  _id,
  altIt, altEn,
  titleIt, titleEn,
  placeIt, placeEn,
  year,
  "url": image.asset->url,
  "aspectRatio": image.asset->metadata.dimensions.aspectRatio,
  "lqip": image.asset->metadata.lqip
`

export const projectsIndexQuery = defineQuery(`
  *[_type == "project" && defined(slug.current)] | order(year desc, titleIt asc){
    _id,
    titleIt, titleEn,
    year,
    "slug": slug.current,
    "cover": cover->{${PROJECT_PHOTO_FIELDS}}
  }
`)

export const projectBySlugQuery = defineQuery(`
  *[_type == "project" && slug.current == $slug][0]{
    _id,
    titleIt, titleEn,
    descriptionIt, descriptionEn,
    year,
    "slug": slug.current,
    "cover": cover->{${PROJECT_PHOTO_FIELDS}},
    "photos": photos[defined(@->)]->{${PROJECT_PHOTO_FIELDS}}
  }
`)

export const projectSlugsQuery = defineQuery(`
  *[_type == "project" && defined(slug.current)].slug.current
`)

export const sitemapQuery = defineQuery(`{
  "projects": *[_type == "project" && defined(slug.current)]{
    "slug": slug.current,
    _updatedAt
  },
  "settingsUpdatedAt": *[_type == "siteSettings"][0]._updatedAt
}`)

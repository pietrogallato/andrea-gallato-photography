import type { StructureResolver } from 'sanity/structure'
import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list'

const SINGLETONS = [
  { id: 'homePage', title: 'Homepage' },
  { id: 'aboutPage', title: 'About' },
  { id: 'siteSettings', title: 'Impostazioni' },
] as const

export const deskStructure: StructureResolver = (S, context) =>
  S.list()
    .title('Contenuti')
    .items([
      S.listItem()
        .title('Homepage')
        .id('homePage')
        .child(S.document().schemaType('homePage').documentId('homePage')),

      orderableDocumentListDeskItem({
        type: 'photo',
        title: 'Fotografie',
        S,
        context,
      }),

      S.documentTypeListItem('project').title('Progetti'),

      S.listItem()
        .title('About')
        .id('aboutPage')
        .child(S.document().schemaType('aboutPage').documentId('aboutPage')),

      S.listItem()
        .title('Impostazioni')
        .id('siteSettings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
    ])

export const SINGLETON_TYPES: ReadonlySet<string> = new Set(SINGLETONS.map((s) => s.id))

import { defineField, defineType } from 'sanity'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Impostazioni',
  type: 'document',
  fields: [
    defineField({
      name: 'photographerName',
      title: 'Nome del fotografo',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'seoTitleIt',
      title: 'Titolo SEO (italiano)',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'seoTitleEn', title: 'Titolo SEO (inglese)', type: 'string' }),
    defineField({
      name: 'seoDescriptionIt',
      title: 'Descrizione SEO (italiano)',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'seoDescriptionEn', title: 'Descrizione SEO (inglese)', type: 'text', rows: 3 }),
    defineField({
      name: 'socialImage',
      title: 'Immagine social predefinita',
      type: 'image',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email di fallback',
      type: 'string',
      validation: (rule) => rule.email(),
    }),
  ],
  preview: { prepare: () => ({ title: 'Impostazioni' }) },
})

import { defineField, defineType } from 'sanity'

export const project = defineType({
  name: 'project',
  title: 'Progetto',
  type: 'document',
  fields: [
    defineField({
      name: 'titleIt',
      title: 'Titolo (italiano)',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'titleEn', title: 'Titolo (inglese)', type: 'string' }),
    defineField({
      name: 'descriptionIt',
      title: 'Descrizione (italiano)',
      type: 'text',
      rows: 4,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'descriptionEn', title: 'Descrizione (inglese)', type: 'text', rows: 4 }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'titleIt', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Anno',
      type: 'number',
      validation: (rule) => rule.integer().min(1950).max(new Date().getFullYear()),
    }),
    defineField({
      name: 'cover',
      title: 'Fotografia di copertina',
      type: 'reference',
      to: [{ type: 'photo' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'photos',
      title: 'Fotografie',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'photo' }] }],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'featured',
      title: 'In evidenza',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: 'titleIt', subtitle: 'year', media: 'cover.image' },
  },
})

import { defineField, defineType } from 'sanity'

export const homePage = defineType({
  name: 'homePage',
  title: 'Homepage',
  type: 'document',
  fields: [
    defineField({
      name: 'heroPhoto',
      title: 'Fotografia protagonista',
      type: 'reference',
      to: [{ type: 'photo' }],
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'introIt', title: 'Introduzione (italiano)', type: 'text', rows: 3 }),
    defineField({ name: 'introEn', title: 'Introduzione (inglese)', type: 'text', rows: 3 }),
    defineField({
      name: 'selectedPhotos',
      title: 'Fotografie selezionate',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'photo' }] }],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'selectedProjects',
      title: 'Progetti selezionati',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'project' }] }],
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: { prepare: () => ({ title: 'Homepage' }) },
})

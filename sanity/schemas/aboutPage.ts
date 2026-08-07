import { defineField, defineType } from 'sanity'

export const aboutPage = defineType({
  name: 'aboutPage',
  title: 'About',
  type: 'document',
  fields: [
    defineField({
      name: 'portrait',
      title: 'Ritratto',
      type: 'image',
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'bioIt',
      title: 'Biografia (italiano)',
      type: 'text',
      rows: 6,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'bioEn', title: 'Biografia (inglese)', type: 'text', rows: 6 }),
    defineField({
      name: 'statementIt',
      title: 'Statement (italiano)',
      type: 'text',
      rows: 6,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'statementEn', title: 'Statement (inglese)', type: 'text', rows: 6 }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (rule) => rule.required().email(),
    }),
    defineField({
      name: 'socialLinks',
      title: 'Collegamenti social',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({ name: 'label', type: 'string', validation: (r) => r.required() }),
            defineField({
              name: 'url',
              type: 'url',
              validation: (r) => r.required().uri({ scheme: ['http', 'https'] }),
            }),
          ],
        },
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'About' }) },
})

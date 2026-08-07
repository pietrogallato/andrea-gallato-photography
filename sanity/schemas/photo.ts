import { defineField, defineType } from 'sanity'
import { orderRankField } from '@sanity/orderable-document-list'

export const photo = defineType({
  name: 'photo',
  title: 'Fotografia',
  type: 'document',
  fields: [
    defineField({
      name: 'image',
      title: 'Immagine',
      type: 'image',
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'altIt',
      title: 'Testo alternativo (italiano)',
      type: 'string',
      description: 'Descrive la fotografia a chi non può vederla. Obbligatorio.',
      validation: (rule) => rule.required().min(3),
    }),
    defineField({
      name: 'altEn',
      title: 'Testo alternativo (inglese)',
      type: 'string',
      description: 'Se vuoto viene usato quello italiano.',
    }),
    defineField({ name: 'titleIt', title: 'Titolo (italiano)', type: 'string' }),
    defineField({ name: 'titleEn', title: 'Titolo (inglese)', type: 'string' }),
    defineField({ name: 'placeIt', title: 'Luogo (italiano)', type: 'string' }),
    defineField({ name: 'placeEn', title: 'Luogo (inglese)', type: 'string' }),
    defineField({
      name: 'year',
      title: 'Anno',
      type: 'number',
      validation: (rule) => rule.integer().min(1950).max(new Date().getFullYear()),
    }),
    defineField({
      name: 'showInGallery',
      title: 'Mostra nella galleria',
      type: 'boolean',
      initialValue: false,
      description: 'Disattivato per impostazione iniziale. Le fotografie restano comunque usabili nei progetti.',
    }),
    orderRankField({ type: 'photo' }),
  ],
  preview: {
    select: { title: 'titleIt', subtitle: 'altIt', media: 'image' },
    prepare: ({ title, subtitle, media }) => ({
      title: title || subtitle || 'Senza titolo',
      subtitle: title ? subtitle : undefined,
      media,
    }),
  },
})

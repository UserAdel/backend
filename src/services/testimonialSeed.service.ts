import { Testimonial } from '../models/testimonial.model.js';

export const DEFAULT_TESTIMONIALS = [
  {
    name: 'Sophie Laurent',
    rating: 5,
    text: {
      en: 'Amazing experience! Our guide spoke perfect French and the Orange Bay trip was unforgettable.',
      fr: 'Expérience incroyable! Notre guide parlait parfaitement français et le voyage à Orange Bay était inoubliable.',
    },
    activity: { en: 'Orange Bay', fr: 'Orange Bay' },
    sortOrder: 0,
    isActive: true,
  },
  {
    name: 'Pierre Martin',
    rating: 5,
    text: {
      en: 'The Luxor tour exceeded all expectations. Professional guides and excellent organization.',
      fr: 'La visite de Louxor a dépassé toutes les attentes. Guides professionnels et excellente organisation.',
    },
    activity: { en: 'Luxor', fr: 'Luxor' },
    sortOrder: 1,
    isActive: true,
  },
  {
    name: 'Marie Dubois',
    rating: 5,
    text: {
      en: 'Swimming with dolphins was a dream come true! Highly recommend for families.',
      fr: 'Nager avec les dauphins était un rêve devenu réalité! Hautement recommandé pour les familles.',
    },
    activity: {
      en: 'Swim with Dolphins',
      fr: 'Swim with Dolphins',
    },
    sortOrder: 2,
    isActive: true,
  },
] as const;

export async function seedDefaultTestimonials() {
  await Promise.all(
    DEFAULT_TESTIMONIALS.map((testimonial) =>
      Testimonial.updateOne(
        { name: testimonial.name },
        { $setOnInsert: testimonial },
        { upsert: true, runValidators: true }
      )
    )
  );

  return DEFAULT_TESTIMONIALS.length;
}

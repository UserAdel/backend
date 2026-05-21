import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function extractArray(source: string, exportName: string) {
  const exportIndex = source.indexOf(`export const ${exportName}`);
  if (exportIndex === -1) {
    throw new Error(`Could not find ${exportName} in frontend static data`);
  }

  const assignmentIndex = source.indexOf('=', exportIndex);
  if (assignmentIndex === -1) {
    throw new Error(`Could not find ${exportName} assignment`);
  }

  const arrayStart = source.indexOf('[', assignmentIndex);
  if (arrayStart === -1) {
    throw new Error(`Could not find ${exportName} array start`);
  }

  let depth = 0;
  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth === 0) {
      return source.slice(arrayStart, index + 1);
    }
  }

  throw new Error(`Could not find ${exportName} array end`);
}

function extractObject(source: string, exportName: string) {
  const exportIndex = source.indexOf(`export const ${exportName}`);
  if (exportIndex === -1) {
    throw new Error(`Could not find ${exportName} in frontend static data`);
  }

  const assignmentIndex = source.indexOf('=', exportIndex);
  if (assignmentIndex === -1) {
    throw new Error(`Could not find ${exportName} assignment`);
  }

  const objectStart = source.indexOf('{', assignmentIndex);
  if (objectStart === -1) {
    throw new Error(`Could not find ${exportName} object start`);
  }

  let depth = 0;
  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(objectStart, index + 1);
    }
  }

  throw new Error(`Could not find ${exportName} object end`);
}

function normalizeStaticSource(source: string) {
  return source.replace(/tourismImages\.([a-zA-Z0-9_]+)/g, "'$1'");
}

function evaluateValue<T>(valueSource: string): T {
  return vm.runInNewContext(`(${normalizeStaticSource(valueSource)})`, {}, { timeout: 1000 }) as T;
}

const legacyPricingLabels: Record<string, { en: string; fr: string }> = {
  adult: { en: 'Adult', fr: 'Adulte' },
  child: { en: 'Children', fr: 'Enfants' },
  private: { en: 'Private', fr: 'Privé' },
  extraPerson: { en: 'Extra person', fr: 'Personne supplémentaire' },
  visitor: { en: 'Visitor', fr: 'Visiteur' },
};

const legacyPricingOrder = ['adult', 'child', 'private', 'extraPerson', 'visitor'];

function legacyPricingToFields(pricing: Record<string, number>) {
  return legacyPricingOrder.reduce<Array<{ id: string; name: { en: string; fr: string }; price: number; isMain: boolean }>>(
    (fields, key) => {
      const price = pricing[key];
      const name = legacyPricingLabels[key];
      if (price !== undefined && name) {
        fields.push({
          id: key,
          name,
          price,
          isMain: key === 'adult' || fields.length === 0,
        });
      }

      return fields;
    },
    []
  );
}

export interface SeedActivity {
  id: string;
  slug: string;
  name: { en: string; fr: string };
  category: string;
  description: { en: string; fr: string };
  highlights: { en: string[]; fr: string[] };
  pricing: Record<string, number>;
  pricingFields?: Array<{ id?: string; name: { en: string; fr: string }; price: number; isMain?: boolean }>;
  ageRestrictions: { en: string; fr: string };
  duration: string;
  startTime?: string;
  endTime?: string;
  times?: string[];
  maxCapacity?: number;
  maxWeight?: number;
  included: { en: string[]; fr: string[] };
  excluded?: { en: string[]; fr: string[] };
  imageUrl: string;
  galleryImages?: string[];
  featured?: boolean;
  childFriendly: boolean;
  familyFriendly: boolean;
  pickupIncluded: boolean;
  availableDaily?: boolean;
  freeCancellation?: boolean;
  privateAvailable: boolean;
  groupAvailable: boolean;
  reviews?: Array<{
    name: string;
    country: string;
    rating: number;
    comment: string;
    date?: string;
    createdAt?: Date;
  }>;
  videoHighlights?: Array<{
    id?: string;
    title: string;
    youtubeUrl: string;
    youtubeId?: string;
    thumbnail?: string;
  }>;
}

export interface SeedCategory {
  id: string;
  name: { en: string; fr: string };
}

export async function loadStaticActivitySeedData() {
  const frontendActivitiesPath = resolve(
    __dirname,
    '../../../frontend/src/data/activities.ts'
  );
  const frontendMediaPath = resolve(
    __dirname,
    '../../../frontend/src/data/activityMedia.ts'
  );
  const [source, mediaSource] = await Promise.all([
    readFile(frontendActivitiesPath, 'utf8'),
    readFile(frontendMediaPath, 'utf8'),
  ]);

  const activities = evaluateValue<SeedActivity[]>(extractArray(source, 'activities'));
  const categories = evaluateValue<SeedCategory[]>(extractArray(source, 'categories'));
  const activityGalleries = evaluateValue<Record<string, string[]>>(
    extractObject(mediaSource, 'activityGalleries')
  );
  const activityTestimonials = evaluateValue<Record<string, Array<{
    name: string;
    nationality: string;
    rating: number;
    text: string;
    date: string;
  }>>>(extractObject(mediaSource, 'activityTestimonials'));
  const activityVideos = evaluateValue<Record<string, Array<{
    id?: string;
    thumbnail?: string;
    title: string;
    youtubeId?: string;
    embedUrl?: string;
  }>>>(extractObject(mediaSource, 'activityVideos'));

  const activitiesWithGalleries = activities.map((activity) => ({
    ...activity,
    pricingFields: activity.pricingFields?.length
      ? activity.pricingFields
      : legacyPricingToFields(activity.pricing),
    availableDaily: activity.availableDaily ?? true,
    freeCancellation: activity.freeCancellation ?? true,
    galleryImages: Array.from(
      new Set((activityGalleries[activity.slug] ?? activityGalleries[activity.id] ?? [])
        .filter((imageUrl) => imageUrl !== activity.imageUrl))
    ),
    reviews: (activityTestimonials[activity.slug] ?? activityTestimonials[activity.id] ?? [])
      .map((review) => ({
        name: review.name,
        country: review.nationality,
        rating: review.rating,
        comment: review.text,
        date: review.date,
      })),
    videoHighlights: (activityVideos[activity.slug] ?? activityVideos[activity.id] ?? [])
      .map((video, index) => ({
        id: video.id ?? `${activity.slug}-video-${index + 1}`,
        title: video.title,
        youtubeUrl: video.youtubeId
          ? `https://www.youtube.com/watch?v=${video.youtubeId}`
          : video.embedUrl ?? '',
        youtubeId: video.youtubeId,
        thumbnail: video.thumbnail,
      }))
      .filter((video) => video.youtubeUrl),
  }));

  return { activities: activitiesWithGalleries, categories };
}

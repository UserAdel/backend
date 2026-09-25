import { Activity } from '../models/activity.model.js';

export const SLUG_ALIASES: Record<string, string> = {
  'orange-bay': 'orange-bay-island-snorkeling-cruise',
  'orange-bay-island': 'orange-bay-island-snorkeling-cruise',
  'luxor': 'luxor-day-trip-by-minivan',
  'luxor-day-trip': 'luxor-day-trip-by-minivan',
  'grand-egyptian-museum': 'cairo-grand-egyptian-museum-day-trip-van-option',
  'cairo-museum': 'cairo-grand-egyptian-museum-day-trip-van-option',
  'swim-with-dolphins': 'swim-with-dolphins-experience',
  'dolphin-photo': 'dolphin-photo-experience',
  'dolphin-house': 'dolphin-house-snorkeling-cruise',
  'dolphin-show': 'dolphin-show-at-dolphins-world',
  'eden-island': 'eden-island-all-inclusive-escape',
  'hula-hula': 'hula-hula-island-cruise',
  'aquarium': 'hurghada-grand-aquarium-experience',
  'spa': 'luxury-spa-wellness-experience',
  'spa-hammam': 'luxury-spa-wellness-experience',
  'mahmya': 'mahmya-island-paradise-escape',
  'quad': 'mini-desert-safari-by-quad',
  'quad-desert-safari': 'mini-desert-safari-by-quad',
  'quad-safari': 'mini-desert-safari-by-quad',
  'ozirea': 'ozirea-island-private-escape',
  'parasailing': 'parasailing-adventure-hurghada',
  'speed-boat': 'private-speed-boat-snorkeling-adventure',
  'royal-seascope': 'royal-seascope-glass-bottom-boat-tour',
  'scuba-diving': 'scuba-diving-experience-in-hurghada',
  'horse-riding': 'sunset-horse-riding-adventure',
  'super-safari': 'super-desert-safari-adventure',
  'cairo-pyramids': 'cairo-pyramids-egyptian-museum-day-trip',
};

export async function findActivityBySlugOrAlias(
  rawSlug: string | string[] | undefined,
  isLean = true
): Promise<any> {
  if (!rawSlug) return null;
  const slugStr = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  if (!slugStr || typeof slugStr !== 'string') return null;
  const normalizedSlug = slugStr.trim().toLowerCase();

  // 1. Direct match
  const directQuery = Activity.findOne({ slug: normalizedSlug, isActive: true });
  const directResult = isLean ? await directQuery.lean() : await directQuery;
  if (directResult) return directResult;

  // 2. Alias dictionary match
  const aliasTarget = SLUG_ALIASES[normalizedSlug];
  if (aliasTarget) {
    const aliasQuery = Activity.findOne({ slug: aliasTarget, isActive: true });
    const aliasResult = isLean ? await aliasQuery.lean() : await aliasQuery;
    if (aliasResult) return aliasResult;
  }

  // 3. Fallback: match by slug containment/prefix
  const sanitized = normalizedSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regexQuery = Activity.findOne({
    slug: { $regex: new RegExp(`(^|-)${sanitized}(-|$)`, 'i') },
    isActive: true,
  });
  return isLean ? await regexQuery.lean() : await regexQuery;
}

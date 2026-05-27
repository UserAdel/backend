import type { Request, Response, NextFunction } from 'express';

const fieldLabels: Record<string, string> = {
  id: 'ID',
  slug: 'Slug',
  'name.en': 'Name (English)',
  'name.fr': 'Name (French)',
  category: 'Category',
  'description.en': 'Description (English)',
  'description.fr': 'Description (French)',
  duration: 'Duration',
  imageUrl: 'Main image',
  pricingFields: 'Pricing fields',
  featured: 'Featured',
  childFriendly: 'Child friendly',
  familyFriendly: 'Family friendly',
  pickupIncluded: 'Pickup included',
  privateAvailable: 'Private available',
  groupAvailable: 'Group available',
  'pricing.adult': 'Adult price',
  'pricing.child': 'Child price',
  'pricing.private': 'Private price',
};

function humanizeFieldPath(path: (string | number)[]): string {
  const joined = path.join('.');
  if (fieldLabels[joined]) return fieldLabels[joined];

  // Handle array items like videoReviews.0.youtubeUrl → "Video review #1 - YouTube URL"
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (typeof segment === 'number') {
      // Attach index to previous part
      if (parts.length > 0) {
        parts[parts.length - 1] += ` #${segment + 1}`;
      }
    } else {
      // Convert camelCase to readable: youtubeUrl → YouTube URL, nameEn → Name en
      const readable = String(segment)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());
      parts.push(fieldLabels[segment] || readable);
    }
  }

  return parts.join(' - ');
}

function humanizeMessage(detail: any): string {
  const label = humanizeFieldPath(detail.path);
  const type: string = detail.type;

  switch (type) {
    case 'any.required':
    case 'string.empty':
      return `${label} is required`;
    case 'string.min':
      return `${label} must be at least ${detail.context?.limit} characters`;
    case 'string.max':
      return `${label} must be at most ${detail.context?.limit} characters`;
    case 'string.uri':
      return `${label} must be a valid URL`;
    case 'string.email':
      return `${label} must be a valid email`;
    case 'number.min':
      return `${label} must be at least ${detail.context?.limit}`;
    case 'number.max':
      return `${label} must be at most ${detail.context?.limit}`;
    case 'number.integer':
      return `${label} must be a whole number`;
    case 'number.base':
      return `${label} must be a number`;
    case 'boolean.base':
      return `${label} must be true or false`;
    case 'array.min':
      return `${label} must have at least ${detail.context?.limit} item(s)`;
    case 'any.only':
      return `${label} must be one of: ${detail.context?.valids?.join(', ')}`;
    default:
      return `${label}: ${detail.message.replace(/^"[^"]*"\s*/, '')}`;
  }
}

export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail: any) => humanizeMessage(detail));

      return res.status(400).json({
        success: false,
        message: errors.join('. '),
        errors,
      });
    }

    next();
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { connectDB, mongoose } from './db.connection.js';
import { Activity } from '../models/activity.model.js';
import { ActivityCategory } from '../models/activityCategory.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup environment
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hurghada_french_guide';

const categoryTranslations: Record<string, string> = {
  'Island Trips': 'Excursions sur l\'île',
  'Animal Experiences': 'Expériences avec les animaux',
  'Sea Trips & Snorkeling': 'Excursions en mer et plongée avec tuba',
  'Historical & Cultural Tours': 'Visites historiques et culturelles',
  'Private Sea Trips': 'Excursions en mer privées',
  'Sea Trips & Family Activities': 'Excursions en mer et activités familiales',
  'Family Activities & Wildlife Experiences': 'Activités familiales et expériences avec la faune'
};

const seedDatabaseFromOdt = async () => {
  try {
    console.log('🌱 Starting database seeding from ODT JSON...');
    
    // Connect to DB
    await connectDB(MONGODB_URI);

    // Delete old data first
    const deletedActivities = await Activity.deleteMany({});
    console.log(`🗑️  Deleted ${deletedActivities.deletedCount} old activities.`);

    const deletedCategories = await ActivityCategory.deleteMany({});
    console.log(`🗑️  Deleted ${deletedCategories.deletedCount} old activity categories.`);

    // Read activities.json
    const jsonPath = path.resolve(__dirname, '../../../activities.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`activities.json not found at ${jsonPath}`);
    }
    
    const activitiesRaw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // Extract unique categories
    const categoryMap = new Map();
    for (const act of activitiesRaw) {
      if (!act.category) act.category = 'Uncategorized';
      
      const catId = act.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: {
            en: act.category,
            fr: categoryTranslations[act.category] || act.category
          },
          isActive: true
        });
      }
      // Update activity to reference the category id
      act.category = catId;
    }

    const categories = Array.from(categoryMap.values());

    // Insert categories
    await Promise.all(
      categories.map((category) =>
        ActivityCategory.findOneAndUpdate(
          { id: category.id },
          category,
          { upsert: true, returnDocument: 'after', runValidators: true }
        )
      )
    );
    console.log(`✅ Seeded ${categories.length} activity categories.`);

    // Map pricing to pricingFields for legacy compatibility
    const legacyPricingLabels: Record<string, { en: string; fr: string }> = {
      adult: { en: 'Adult', fr: 'Adulte' },
      child: { en: 'Children', fr: 'Enfants' },
      private: { en: 'Private', fr: 'Privé' },
      extraPerson: { en: 'Extra person', fr: 'Personne supplémentaire' },
      visitor: { en: 'Visitor', fr: 'Visiteur' },
    };
    
    const legacyPricingOrder = ['adult', 'child', 'private', 'extraPerson', 'visitor'];

    // Process activities
    const activitiesToInsert = activitiesRaw.map((act: any) => {
      // Create pricingFields
      const pricingFields: any[] = [];
      if (act.pricing) {
        for (const key of legacyPricingOrder) {
          if (act.pricing[key] !== undefined) {
            pricingFields.push({
              id: key,
              name: legacyPricingLabels[key] || { en: key, fr: key },
              price: act.pricing[key],
              isMain: key === 'adult' || pricingFields.length === 0
            });
          }
        }
      }

      return {
        ...act,
        duration: act.duration || 'Contact for details',
        pricingFields,
        isActive: true,
      };
    });

    // Insert activities
    await Promise.all(
      activitiesToInsert.map((activity: any) =>
        Activity.findOneAndUpdate(
          { slug: activity.slug },
          activity,
          { upsert: true, returnDocument: 'after', runValidators: true }
        )
      )
    );

    console.log(`✅ Seeded ${activitiesToInsert.length} activities from ODT JSON.`);

    // Close connection
    await mongoose.connection.close();
    console.log('👋 Seeding process finished, connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

seedDatabaseFromOdt();

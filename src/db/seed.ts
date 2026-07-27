import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { connectDB, mongoose } from './db.connection.js';
import { Activity } from '../models/activity.model.js';
import { ActivityCategory } from '../models/activityCategory.model.js';
import { AdminUser } from '../models/adminUser.model.js';
import { loadStaticActivitySeedData } from '../services/staticActivitySeed.service.js';
import { seedDefaultTestimonials } from '../services/testimonialSeed.service.js';

// Setup environment
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hurghada_french_guide';
const DEFAULT_ADMIN = {
  phone: '01119915593',
  password: '123456',
  name: 'Admin',
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // 1. Connect to DB
    await connectDB(MONGODB_URI);

    const { activities, categories } = await loadStaticActivitySeedData();

    await Promise.all(
      activities.map((activity) =>
        Activity.findOneAndUpdate(
          { slug: activity.slug },
          { ...activity, isActive: true },
          { upsert: true, returnDocument: 'after', runValidators: true }
        )
      )
    );

    console.log(`✅ Seeded ${activities.length} activities from frontend static data.`);

    await Promise.all(
      categories.map((category) =>
        ActivityCategory.findOneAndUpdate(
          { id: category.id },
          { ...category, isActive: true },
          { upsert: true, returnDocument: 'after', runValidators: true }
        )
      )
    );

    console.log(`✅ Seeded ${categories.length} activity categories from frontend static data.`);

    const testimonialCount = await seedDefaultTestimonials();
    console.log(`✅ Seeded ${testimonialCount} homepage testimonials.`);

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 12);
    await AdminUser.findOneAndUpdate(
      { phone: DEFAULT_ADMIN.phone },
      {
        phone: DEFAULT_ADMIN.phone,
        passwordHash,
        name: DEFAULT_ADMIN.name,
        role: 'admin',
        isActive: true,
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    console.log(`✅ Seeded admin user ${DEFAULT_ADMIN.phone}.`);

    // 2. Close connection
    await mongoose.connection.close();
    console.log('👋 Seeding process finished, connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

seedDatabase();

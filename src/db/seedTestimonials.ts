import dotenv from 'dotenv';
import { connectDB, mongoose } from './db.connection.js';
import { seedDefaultTestimonials } from '../services/testimonialSeed.service.js';

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';
dotenv.config({ path: envFile });

const mongoDbUri =
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/hurghada_french_guide';

async function runTestimonialSeed() {
  try {
    console.log('🌱 Seeding homepage testimonials...');
    await connectDB(mongoDbUri);
    const seededCount = await seedDefaultTestimonials();
    console.log(`✅ Seeded ${seededCount} homepage testimonials.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding homepage testimonials:', error);
    process.exit(1);
  }
}

runTestimonialSeed();

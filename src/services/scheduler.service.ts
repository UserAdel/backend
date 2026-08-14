/**
 * Daily 9:00 AM scheduler
 * Sends the admin a list of all customers arriving tomorrow.
 */

import cron from 'node-cron';
import { BookingRequest } from '../models/bookingRequest.model.js';
import { getWhatsappConfig, sendWhatsappMessage } from './whatsapp.service.js';

function getTomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function sendDailyDigest(): Promise<void> {
  const { adminPhone } = await getWhatsappConfig();
  if (!adminPhone) {
    console.warn('[Scheduler] Admin notification phone not set — skipping daily digest.');
    return;
  }

  const tomorrow = getTomorrowDateString();

  // Find all bookings where the ACTIVITY DATE (preferredDate) = tomorrow
  const bookings = await BookingRequest.find({
    preferredDate: tomorrow,
    status: { $in: ['new', 'contacted', 'confirmed', 'pending'] },
  }).lean();

  if (bookings.length === 0) {
    const msg = `📋 *مواعيد النشاطات ليوم ${tomorrow}*\n\nلا يوجد نشاطات مجدولة لغداً. ✅`;
    await sendWhatsappMessage(adminPhone, msg);
    return;
  }

  let msg =
    `📋 *مواعيد النشاطات لغداً ${tomorrow}*\n` +
    `عدد الحجوزات: *${bookings.length}*\n` +
    `${'─'.repeat(30)}\n\n`;

  bookings.forEach((b, i) => {
    const total = b.adults + b.children;
    msg +=
      `*${i + 1}.* ${b.fullName}\n` +
      `   🏄 ${b.activityName}\n` +
      `   ✈️ تاريخ الوصول: ${b.arrivalDate}\n` +
      `   📅 موعد النشاط: ${b.preferredDate}\n` +
      `   👥 ${b.adults} بالغ + ${b.children} طفل (إجمالي: ${total})\n` +
      `   🌍 ${b.nationality}\n` +
      `   📲 واتساب: ${b.whatsapp}\n` +
      (b.specialRequests ? `   📝 ${b.specialRequests}\n` : '') +
      `\n`;
  });

  msg += `\nصباح الخير! يوم سعيد 🌊`;

  await sendWhatsappMessage(adminPhone, msg);
  console.log(`[Scheduler] Daily digest sent for ${tomorrow} (${bookings.length} bookings)`);
}

/**
 * Starts the daily 9 AM cron job (Cairo timezone UTC+3 = 06:00 UTC).
 * Cron pattern: second? minute hour day month weekday
 *   "0 6 * * *"  → every day at 06:00 UTC = 09:00 Cairo time
 */
export function startDailyDigestScheduler(): void {
  cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Running daily digest...');
    try {
      await sendDailyDigest();
    } catch (err) {
      console.error('[Scheduler] Error in daily digest:', err);
    }
  });

  console.log('📅 Daily digest scheduler started (runs at 09:00 Cairo time)');
}

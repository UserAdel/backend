/**
 * Daily 9:00 PM Cairo scheduler.
 * Requests arrival details from tomorrow's arrivals and sends the admin a
 * combined report for tomorrow's activities and arrivals.
 */

import cron from 'node-cron';
import { BookingRequest } from '../models/bookingRequest.model.js';
import {
  getWhatsappConfig,
  sendPreArrivalDetailsRequest,
  sendWhatsappMessage,
} from './whatsapp.service.js';

const cairoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Africa/Cairo',
  year: 'numeric',
});

function getTomorrowDateString(now = new Date()): string {
  const dateParts = cairoDateFormatter.formatToParts(now);
  const year = Number(dateParts.find((part) => part.type === 'year')?.value ?? 0);
  const month = Number(dateParts.find((part) => part.type === 'month')?.value ?? 0);
  const day = Number(dateParts.find((part) => part.type === 'day')?.value ?? 0);
  const tomorrow = new Date(Date.UTC(
    year,
    month - 1,
    day + 1,
  ));

  return tomorrow.toISOString().slice(0, 10);
}

interface Booking {
  activityName: string;
  adults: number;
  arrivalDate: string;
  children: number;
  fullName: string;
  language: string;
  nationality: string;
  preferredDate: string;
  specialRequests?: string | null;
  whatsapp: string;
}

function formatBookingForAdmin(booking: Booking, index: number): string {
  const totalGuests = booking.adults + booking.children;

  return (
    `*${index + 1}.* ${booking.fullName}\n` +
    `   🏄 النشاط: ${booking.activityName}\n` +
    `   ✈️ الوصول: ${booking.arrivalDate}\n` +
    `   📅 موعد النشاط: ${booking.preferredDate}\n` +
    `   👥 ${booking.adults} بالغ + ${booking.children} طفل (الإجمالي: ${totalGuests})\n` +
    `   🌍 الجنسية: ${booking.nationality}\n` +
    `   📲 واتساب: ${booking.whatsapp}\n` +
    (booking.specialRequests ? `   📝 ${booking.specialRequests}\n` : '')
  );
}

function formatReportSection(title: string, bookings: Booking[]): string {
  if (bookings.length === 0) {
    return `${title} *(0)*\nلا توجد حجوزات. ✅\n`;
  }

  return (
    `${title} *(${bookings.length})*\n` +
    bookings.map(formatBookingForAdmin).join('\n')
  );
}

async function sendPreArrivalReminders(arrivalBookings: Booking[]): Promise<void> {
  const remindersByWhatsapp = new Map<string, Booking>();
  arrivalBookings.forEach((booking) => {
    const whatsapp = booking.whatsapp.trim();
    if (whatsapp && !remindersByWhatsapp.has(whatsapp)) {
      remindersByWhatsapp.set(whatsapp, booking);
    }
  });

  await Promise.all(
    Array.from(remindersByWhatsapp.values()).map((booking) =>
      sendPreArrivalDetailsRequest({
        fullName: booking.fullName,
        language: booking.language,
        whatsapp: booking.whatsapp,
      })
    ),
  );

  console.log(
    `[Scheduler] Sent ${remindersByWhatsapp.size} pre-arrival reminder(s).`,
  );
}

async function sendDailyBookingMessages(): Promise<void> {
  const tomorrow = getTomorrowDateString();
  const activeStatuses = ['new', 'contacted', 'confirmed', 'pending'];

  const [activityBookings, arrivalBookings] = await Promise.all([
    BookingRequest.find({
      preferredDate: tomorrow,
      status: { $in: activeStatuses },
    }).sort({ preferredDate: 1, fullName: 1 }).lean(),
    BookingRequest.find({
      arrivalDate: tomorrow,
      status: { $in: activeStatuses },
    }).sort({ arrivalDate: 1, fullName: 1 }).lean(),
  ]);

  await sendPreArrivalReminders(arrivalBookings);

  const { adminPhone } = await getWhatsappConfig();
  if (!adminPhone) {
    console.warn('[Scheduler] Admin notification phone not set — skipping daily report.');
    return;
  }

  const report =
    `📋 *تقرير حجوزات الغد — ${tomorrow}*\n` +
    `${'─'.repeat(30)}\n\n` +
    formatReportSection('🏄 الأنشطة التي موعدها غدًا', activityBookings) +
    `\n${'─'.repeat(30)}\n\n` +
    formatReportSection('✈️ العملاء الذين وصولهم غدًا', arrivalBookings);

  await sendWhatsappMessage(adminPhone, report);
  console.log(
    `[Scheduler] Daily report sent for ${tomorrow} ` +
    `(${activityBookings.length} activities, ${arrivalBookings.length} arrivals).`,
  );
}

/**
 * Starts the daily job at 9:00 PM in Cairo, including daylight-saving time.
 */
export function startDailyBookingScheduler(): void {
  cron.schedule('0 21 * * *', async () => {
    console.log('[Scheduler] Running 9 PM booking messages...');
    try {
      await sendDailyBookingMessages();
    } catch (err) {
      console.error('[Scheduler] Error sending daily booking messages:', err);
    }
  }, { timezone: 'Africa/Cairo' });

  console.log('📅 Daily booking scheduler started (runs at 21:00 Cairo time)');
}

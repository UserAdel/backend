/**
 * Wapilot WhatsApp messaging service
 * Docs: https://wapilot.io
 */

const WAPILOT_API = 'https://app.wapilot.io/api/send-message';

export interface BookingConfirmationPayload {
  fullName: string;
  whatsapp: string;
  activityName: string;
  arrivalDate: string;
  preferredDate: string;
  adults: number;
  children: number;
  language: string;
  nationality: string;
  specialRequests?: string;
}

function buildMessage(payload: BookingConfirmationPayload): string {
  const isFr = payload.language === 'fr';

  if (isFr) {
    return (
      `✅ *Demande de réservation reçue !*\n\n` +
      `Bonjour *${payload.fullName}*,\n\n` +
      `Merci pour votre réservation. Voici le résumé :\n\n` +
      `🏄 *Activité :* ${payload.activityName}\n` +
      `✈️ *Date d'arrivée :* ${payload.arrivalDate}\n` +
      `📅 *Date souhaitée :* ${payload.preferredDate}\n` +
      `👤 *Adultes :* ${payload.adults}\n` +
      `👶 *Enfants :* ${payload.children}\n` +
      `🌍 *Nationalité :* ${payload.nationality}\n` +
      (payload.specialRequests ? `📝 *Demandes spéciales :* ${payload.specialRequests}\n` : '') +
      `\nNous vous contacterons très bientôt pour confirmer les détails. À bientôt ! 🌊`
    );
  }

  return (
    `✅ *Booking Request Received!*\n\n` +
    `Hello *${payload.fullName}*,\n\n` +
    `Thank you for your booking request. Here's your summary:\n\n` +
    `🏄 *Activity:* ${payload.activityName}\n` +
    `✈️ *Arrival Date:* ${payload.arrivalDate}\n` +
    `📅 *Preferred Date:* ${payload.preferredDate}\n` +
    `👤 *Adults:* ${payload.adults}\n` +
    `👶 *Children:* ${payload.children}\n` +
    `🌍 *Nationality:* ${payload.nationality}\n` +
    (payload.specialRequests ? `📝 *Special Requests:* ${payload.specialRequests}\n` : '') +
    `\nWe will contact you shortly to confirm the details. See you soon! 🌊`
  );
}

/**
 * Sends a WhatsApp confirmation message via Wapilot.
 * Failures are logged but never thrown — the booking is still saved.
 */
export async function sendBookingConfirmation(payload: BookingConfirmationPayload): Promise<void> {
  const instance = process.env.WAPILOT_INSTANCE;
  const token = process.env.WAPILOT_TOKEN;

  if (!instance || !token) {
    console.warn('[Wapilot] WAPILOT_INSTANCE or WAPILOT_TOKEN is not set — skipping WhatsApp notification.');
    return;
  }

  // Normalise phone: strip spaces/dashes, ensure it starts with +
  let phone = payload.whatsapp.replace(/[\s\-().]/g, '');
  if (!phone.startsWith('+')) {
    phone = `+${phone}`;
  }

  const body = {
    instance,
    token,
    phone,
    message: buildMessage(payload),
  };

  try {
    const res = await fetch(WAPILOT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Wapilot] HTTP ${res.status}: ${text}`);
    } else {
      console.log(`[Wapilot] Confirmation sent to ${phone}`);
    }
  } catch (err) {
    console.error('[Wapilot] Failed to send WhatsApp message:', err);
  }
}

import { getStripe } from '../config/stripe.js'

// Stripe doesn't support NPR; sandbox checkout charges the USD equivalent at a fixed rate.
// Production would route through eSewa/Khalti instead, which bill in NPR directly.
const NPR_PER_USD = 133

export function nprToUsdCents(priceNPR) {
  return Math.round((priceNPR / NPR_PER_USD) * 100)
}

export async function createCoursePaymentIntent({ course, userId }) {
  const stripe = getStripe()
  return stripe.paymentIntents.create({
    amount: nprToUsdCents(course.priceNPR),
    currency: 'usd',
    metadata: { courseId: String(course._id), userId: String(userId) },
  })
}

export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
}

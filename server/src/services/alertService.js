import { getRedis } from '../config/redis.js'

export async function sendAlert(message) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn(`[alert] ${message}`)
    return
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  }).catch((err) => console.error('failed to send alert webhook', err))
}

// Counts events under `key` within a rolling window and fires an alert once the count
// crosses `threshold` (only on the crossing request, not on every one after).
export async function flagBurst(key, { windowSeconds, threshold, message }) {
  const redis = getRedis()
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  if (count === threshold) await sendAlert(message)
  return count
}

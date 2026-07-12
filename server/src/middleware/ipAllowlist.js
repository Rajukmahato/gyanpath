import { logAction } from '../services/auditService.js'

// Restricts a route to a configured set of source IPs. Set ADMIN_IP_ALLOWLIST to a
// comma-separated list of exact IPs or dotted prefixes, e.g.
//   ADMIN_IP_ALLOWLIST=203.0.113.7,103.129.135.
// When the variable is unset the guard is disabled (dev-friendly); loopback is always
// allowed so a local admin can never lock themselves out.
function normalize(ip) {
  return (ip || '').replace(/^::ffff:/, '')
}

function isLoopback(ip) {
  return ip === '127.0.0.1' || ip === '::1'
}

function matches(ip, entry) {
  const e = entry.trim()
  if (!e) return false
  // a trailing dot means "prefix / subnet" (203.0.113.  → 203.0.113.*)
  if (e.endsWith('.')) return ip.startsWith(e)
  return ip === e
}

export function requireIpAllowlist(envVar = 'ADMIN_IP_ALLOWLIST') {
  return async (req, res, next) => {
    const raw = process.env[envVar]
    if (!raw) return next() // allow-list not configured — feature disabled

    const ip = normalize(req.ip)
    if (isLoopback(ip)) return next()

    const allowed = raw.split(',').some((entry) => matches(ip, entry))
    if (allowed) return next()

    await logAction({
      actor: req.user?._id,
      role: req.user?.role,
      action: 'ip_allowlist_block',
      resourceType: 'Route',
      resourceId: req.originalUrl,
      ip: req.ip,
      status: 'failure',
    })
    return res.status(403).json({ error: 'access from this network is not permitted' })
  }
}

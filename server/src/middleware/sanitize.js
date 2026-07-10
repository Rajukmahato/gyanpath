// Strips Mongo operator keys ($ne, $gt, $where, ...) and dotted paths out of any
// user-supplied object before it can reach a query filter, mutating in place since
// Express 5's req.query has no setter to reassign wholesale.
function stripOperators(value) {
  if (Array.isArray(value)) {
    value.forEach(stripOperators)
    return
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key]
      } else {
        stripOperators(value[key])
      }
    }
  }
}

export function sanitizeInput(req, res, next) {
  stripOperators(req.body)
  stripOperators(req.query)
  stripOperators(req.params)
  next()
}

// CLIENT_ORIGIN is a comma-separated *list* so the CORS layer can accept the app over
// several hosts (localhost plus a LAN/VM IP). Anywhere we need a single concrete URL to
// hand to a third party or bake into a document — a payment gateway's return_url, a
// redirect back into the SPA, a certificate verification link — only the first entry is
// meaningful. Passing the raw list produces a string that is not a URL at all, which
// gateways reject outright ("Enter a valid URL") and documents embed silently.
export function clientOrigin() {
  return (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim()
}

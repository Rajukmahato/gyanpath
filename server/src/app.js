import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import coursesRouter from './routes/courses.js'
import contentRouter from './routes/content.js'
import enrollmentsRouter from './routes/enrollments.js'
import payoutsRouter from './routes/payouts.js'
import { stripeWebhook } from './controllers/paymentController.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }))

// Stripe needs the raw, unparsed body to verify the webhook signature, so this is
// registered before the global JSON parser below.
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook)

app.use(express.json())
app.use(cookieParser())

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/courses', coursesRouter)
app.use('/api/content', contentRouter)
app.use('/api/enrollments', enrollmentsRouter)
app.use('/api/payouts', payoutsRouter)

export default app

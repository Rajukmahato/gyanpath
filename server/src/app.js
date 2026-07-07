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
import usersRouter from './routes/users.js'
import progressRouter from './routes/progress.js'
import certificatesRouter from './routes/certificates.js'
import paymentsRouter from './routes/payments.js'
import adminRouter from './routes/admin.js'
import { sanitizeInput } from './middleware/sanitize.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }))

app.use(express.json())
app.use(cookieParser())
app.use(sanitizeInput)

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/courses', coursesRouter)
app.use('/api/content', contentRouter)
app.use('/api/enrollments', enrollmentsRouter)
app.use('/api/payouts', payoutsRouter)
app.use('/api/users', usersRouter)
app.use('/api/progress', progressRouter)
app.use('/api/certificates', certificatesRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/admin', adminRouter)

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' })
})

// central error handler: returns JSON and never leaks stack traces to clients
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'already exists' })
  }
  if (err?.name === 'ValidationError' || err?.name === 'CastError') {
    return res.status(400).json({ error: 'invalid request' })
  }
  console.error(err)
  res.status(500).json({ error: 'something went wrong' })
})

export default app

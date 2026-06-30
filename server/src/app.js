import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import healthRouter from './routes/health.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }))
app.use(express.json())

app.use('/api/health', healthRouter)

export default app

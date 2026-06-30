import mongoose from 'mongoose'

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 2000

export async function connectDB() {
  const uri = process.env.MONGO_URI

  if (!uri) {
    throw new Error('MONGO_URI is not set')
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('mongo disconnected')
  })

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri)
      console.log('mongo connected')
      return
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err
      console.warn(`mongo connect failed (attempt ${attempt}/${MAX_RETRIES}), retrying...`)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
}

export async function disconnectDB() {
  await mongoose.connection.close()
}

process.on('SIGINT', async () => {
  await disconnectDB()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await disconnectDB()
  process.exit(0)
})

import 'dotenv/config'
import app from './app.js'
import { connectDB } from './config/db.js'

const port = process.env.PORT || 4000

async function start() {
  await connectDB()
  app.listen(port, () => console.log(`server listening on ${port}`))
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})

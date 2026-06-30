import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Enrollment from '../models/Enrollment.js'

let mongod

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

after(async () => {
  await mongoose.connection.close()
  await mongod.stop()
})

test('rejects a duplicate enrollment for the same user and course', async () => {
  const userId = new mongoose.Types.ObjectId()
  const courseId = new mongoose.Types.ObjectId()

  await Enrollment.create({ userId, courseId })

  await assert.rejects(
    () => Enrollment.create({ userId, courseId }),
    (err) => err.code === 11000,
  )
})

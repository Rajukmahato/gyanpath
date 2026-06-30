import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Nav from '../components/Nav.jsx'

function NewCourseForm({ onCreated }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [priceNPR, setPriceNPR] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const course = await api.createCourse({ title, category, priceNPR: Number(priceNPR) })
    setTitle('')
    setCategory('')
    setPriceNPR('')
    onCreated(course)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <input className="border rounded px-2 py-1" placeholder="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="border rounded px-2 py-1" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
      <input className="border rounded px-2 py-1 w-28" type="number" placeholder="Price NPR" required value={priceNPR} onChange={(e) => setPriceNPR(e.target.value)} />
      <button className="bg-gray-900 text-white rounded px-3 py-1" type="submit">Create</button>
    </form>
  )
}

function CourseRow({ course, onChanged }) {
  const [lessonTitle, setLessonTitle] = useState('')

  async function submit() {
    await api.submitCourse(course._id)
    onChanged()
  }

  async function addLesson(e) {
    e.preventDefault()
    await api.addLesson(course._id, { title: lessonTitle, order: 1, isPreview: false })
    setLessonTitle('')
    onChanged()
  }

  return (
    <div className="border rounded p-3 mb-2">
      <div className="flex justify-between items-center">
        <span className="font-medium">{course.title}</span>
        <span className="text-sm text-gray-500">{course.status}</span>
      </div>
      <div className="flex gap-2 mt-2">
        {course.status === 'draft' && (
          <button onClick={submit} className="text-sm underline">Submit for review</button>
        )}
        <form onSubmit={addLesson} className="flex gap-2">
          <input className="border rounded px-2 py-1 text-sm" placeholder="Lesson title" required value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} />
          <button className="text-sm underline" type="submit">Add lesson</button>
        </form>
      </div>
    </div>
  )
}

export default function InstructorDashboard() {
  const [courses, setCourses] = useState([])
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payouts, setPayouts] = useState([])

  function refresh() {
    api.myCourses().then(setCourses)
    api.myPayouts().then(setPayouts)
  }

  useEffect(refresh, [])

  async function requestPayout(e) {
    e.preventDefault()
    await api.requestPayout(Number(payoutAmount))
    setPayoutAmount('')
    refresh()
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">Instructor dashboard</h1>

        <NewCourseForm onCreated={refresh} />
        {courses.map((c) => (
          <CourseRow key={c._id} course={c} onChanged={refresh} />
        ))}

        <h2 className="font-medium mt-6 mb-2">Payouts</h2>
        <form onSubmit={requestPayout} className="flex gap-2 mb-3">
          <input className="border rounded px-2 py-1 w-32" type="number" placeholder="Amount NPR" required value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
          <button className="bg-gray-900 text-white rounded px-3 py-1" type="submit">Request payout</button>
        </form>
        <ul className="text-sm space-y-1">
          {payouts.map((p) => (
            <li key={p._id}>NPR {p.amountNPR.toLocaleString()} — {p.status}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Nav from '../components/Nav.jsx'

export default function ModeratorQueue() {
  const [courses, setCourses] = useState([])

  function refresh() {
    api.pendingCourses().then(setCourses)
  }

  useEffect(refresh, [])

  async function review(id, decision) {
    await api.reviewCourse(id, decision)
    refresh()
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">Moderation queue</h1>
        {courses.length === 0 && <p className="text-gray-500">Nothing pending.</p>}
        {courses.map((c) => (
          <div key={c._id} className="border rounded p-3 mb-2 flex justify-between items-center">
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="text-sm text-gray-500">{c.instructorId?.email}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => review(c._id, 'approved')} className="text-sm underline">Approve</button>
              <button onClick={() => review(c._id, 'rejected')} className="text-sm underline">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

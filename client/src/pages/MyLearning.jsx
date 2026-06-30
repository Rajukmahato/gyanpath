import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import Nav from '../components/Nav.jsx'

export default function MyLearning() {
  const [enrollments, setEnrollments] = useState([])
  const [message, setMessage] = useState(null)

  function refresh() {
    api.myEnrollments().then(setEnrollments)
  }

  useEffect(refresh, [])

  async function refund(id) {
    try {
      await api.requestRefund(id)
      setMessage('Refund processed.')
      refresh()
    } catch (err) {
      setMessage(err.body?.error || err.message)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">My learning</h1>
        {message && <p className="text-sm mb-3">{message}</p>}
        {enrollments.length === 0 && <p className="text-gray-500">No enrollments yet.</p>}
        {enrollments.map((e) => (
          <div key={e._id} className="border rounded p-3 mb-2 flex justify-between items-center">
            <Link to={`/courses/${e.courseId?._id}`} className="font-medium">{e.courseId?.title}</Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{e.status}</span>
              {e.status === 'active' && (
                <button onClick={() => refund(e._id)} className="text-sm underline">Request refund</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

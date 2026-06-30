import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import Nav from '../components/Nav.jsx'

export default function Browse() {
  const [courses, setCourses] = useState([])

  useEffect(() => {
    api.listCourses().then(setCourses)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">Courses</h1>
        {courses.length === 0 && <p className="text-gray-500">No courses published yet.</p>}
        <div className="grid gap-3">
          {courses.map((c) => (
            <Link
              key={c._id}
              to={`/courses/${c._id}`}
              className="border rounded p-4 hover:bg-gray-50"
            >
              <h2 className="font-medium">{c.title}</h2>
              <p className="text-sm text-gray-600">{c.category}</p>
              <p className="text-sm mt-1">NPR {c.priceNPR.toLocaleString()}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

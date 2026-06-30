import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'
import Nav from '../components/Nav.jsx'

export default function CourseDetail() {
  const { id } = useParams()
  const [course, setCourse] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api.getCourse(id).then(setCourse)
  }, [id])

  if (!course) return null

  function handleEnroll() {
    if (!user) return navigate('/login')
    navigate(`/checkout/${id}`)
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold">{course.title}</h1>
        <p className="text-gray-600 mt-1">{course.description}</p>
        <p className="mt-2 font-medium">NPR {course.priceNPR.toLocaleString()}</p>
        <button onClick={handleEnroll} className="mt-3 bg-gray-900 text-white rounded px-4 py-2">
          Enroll
        </button>

        <h2 className="font-medium mt-6 mb-2">Lessons</h2>
        <ul className="space-y-2">
          {course.lessons?.map((lesson) => (
            <li key={lesson._id} className="border rounded p-3 flex justify-between items-center">
              <span>{lesson.title}</span>
              {lesson.isPreview ? (
                <Link to={`/learn/${course._id}/${lesson._id}`} className="text-sm underline">
                  Preview
                </Link>
              ) : (
                <span className="text-sm text-gray-400">Locked</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

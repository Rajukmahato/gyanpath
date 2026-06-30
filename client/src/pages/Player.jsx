import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import Nav from '../components/Nav.jsx'

export default function Player() {
  const { lessonId } = useParams()
  const [streamUrl, setStreamUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .getSignedUrl(lessonId)
      .then((data) => setStreamUrl(data.streamUrl))
      .catch((err) => setError(err.body?.error || err.message))
  }, [lessonId])

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-2xl mx-auto p-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {streamUrl && (
          <p className="text-sm text-gray-600">
            Access granted — streaming would play from <code>{streamUrl}</code> here once video storage is wired up.
          </p>
        )}
      </div>
    </div>
  )
}

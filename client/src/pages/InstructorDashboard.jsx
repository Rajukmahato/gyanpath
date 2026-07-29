import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Image, MonitorPlay, Pencil, Play, Plus, Send, Upload, Wallet } from 'lucide-react'
import { api, API_URL } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import Input, { Label, Textarea } from '../components/ui/Input.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'

const STATUS_TONE = { draft: 'neutral', pending: 'warning', approved: 'success', rejected: 'danger' }

function extractYouTubeId(input) {
  const s = (input || '').trim()
  if (/^[\w-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/)
  return m ? m[1] : ''
}

function NewCourseForm({ onCreated }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [priceNPR, setPriceNPR] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const course = await api.createCourse({ title, category, description, priceNPR: Number(priceNPR) })
    setTitle(''); setCategory(''); setDescription(''); setPriceNPR('')
    onCreated(course)
  }

  return (
    <Card className="p-5">
      <p className="font-display font-semibold text-ink-900">New course</p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Label className="mb-1 text-xs">Title</Label>
            <Input placeholder="Full-Stack Web Development" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 text-xs">Category</Label>
            <Input placeholder="Coding" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 text-xs">Price (NPR)</Label>
            <Input type="number" min="0" required value={priceNPR} onChange={(e) => setPriceNPR(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="mb-1 text-xs">Description</Label>
          <Textarea rows={2} placeholder="What will students learn?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button type="submit"><Plus className="h-4 w-4" /> Create course</Button>
      </form>
    </Card>
  )
}

function AddLessonForm({ course, nextOrder, onChanged }) {
  const [title, setTitle] = useState('')
  const [videoMode, setVideoMode] = useState('youtube') // 'youtube' | 'file'
  const [youtubeInput, setYoutubeInput] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [minutes, setMinutes] = useState('')
  const [isPreview, setIsPreview] = useState(nextOrder === 1)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)

    let youtubeId
    let videoObjectKey

    if (videoMode === 'youtube') {
      youtubeId = extractYouTubeId(youtubeInput)
      if (youtubeInput && !youtubeId) {
        setError('Enter a valid YouTube link or 11-character video ID.')
        return
      }
    } else if (videoFile) {
      setUploading(true)
      try {
        const result = await api.uploadLessonVideo(course._id, videoFile)
        videoObjectKey = result.videoObjectKey
      } catch (err) {
        setError(err.body?.error || 'Video upload failed.')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    await api.addLesson(course._id, {
      title,
      order: nextOrder,
      isPreview,
      youtubeId: youtubeId || undefined,
      videoObjectKey: videoObjectKey || undefined,
      durationSec: minutes ? Number(minutes) * 60 : undefined,
    })

    setTitle(''); setYoutubeInput(''); setVideoFile(null); setMinutes(''); setIsPreview(false)
    if (fileRef.current) fileRef.current.value = ''
    onChanged()
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-lg border border-dashed border-ink-200 p-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_2fr_auto]">
        <Input placeholder="Lesson title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input className="sm:w-24" type="number" min="0" placeholder="Mins" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </div>

      {/* Video source toggle */}
      <div className="flex gap-1 rounded-lg border border-ink-200 p-1 w-fit">
        <button
          type="button"
          onClick={() => setVideoMode('youtube')}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            videoMode === 'youtube' ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          <MonitorPlay className="h-3.5 w-3.5" /> YouTube
        </button>
        <button
          type="button"
          onClick={() => setVideoMode('file')}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            videoMode === 'file' ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          <Upload className="h-3.5 w-3.5" /> Upload file
        </button>
      </div>

      {videoMode === 'youtube' ? (
        <Input placeholder="YouTube link or video ID (optional)" value={youtubeInput} onChange={(e) => setYoutubeInput(e.target.value)} />
      ) : (
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="text-xs text-ink-600 file:mr-2 file:rounded file:border-0 file:bg-brand-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />
          {videoFile && <span className="text-xs text-ink-500">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</span>}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
          Free preview
        </label>
        <Button variant="ghost" size="sm" type="submit" disabled={uploading}>
          {uploading ? 'Uploading…' : <><Plus className="h-3.5 w-3.5" /> Add lesson</>}
        </Button>
      </div>
    </form>
  )
}

function ThumbnailUpload({ course, onChanged }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      await api.uploadCourseThumbnail(course._id, file)
      onChanged()
    } catch (err) {
      setError(err.body?.error || 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      {course.thumbnailUrl && (
        <img
          src={course.thumbnailUrl.startsWith('/api') ? `${API_URL}${course.thumbnailUrl}` : course.thumbnailUrl}
          alt="thumbnail"
          className="h-12 w-20 rounded object-cover border border-ink-200"
        />
      )}
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 transition-colors">
        <Image className="h-3.5 w-3.5" />
        {uploading ? 'Uploading…' : course.thumbnailUrl ? 'Change thumbnail' : 'Upload thumbnail'}
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={handleFile} />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

function CourseRow({ course, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(course.title)
  const [priceNPR, setPriceNPR] = useState(course.priceNPR)

  const nextOrder = (course.lessons?.length || 0) + 1
  const missingVideo = (course.lessons || []).filter((l) => !l.youtubeId && !l.videoObjectKey).length

  async function submit() {
    await api.submitCourse(course._id)
    onChanged()
  }

  async function saveEdit(e) {
    e.preventDefault()
    await api.updateCourse(course._id, { title, priceNPR: Number(priceNPR) })
    setEditing(false)
    onChanged()
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <form onSubmit={saveEdit} className="flex flex-1 flex-wrap items-center gap-2">
            <Input className="flex-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input className="w-28" type="number" value={priceNPR} onChange={(e) => setPriceNPR(e.target.value)} />
            <Button size="sm" type="submit">Save</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : (
          <>
            <div className="min-w-0">
              <p className="truncate font-display font-semibold text-ink-900">{course.title}</p>
              <p className="text-xs text-ink-400">
                NPR {course.priceNPR.toLocaleString()} · {course.students} student{course.students === 1 ? '' : 's'} · {course.lessons?.length || 0} lessons
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={STATUS_TONE[course.status]} className="capitalize">{course.status}</Badge>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
            </div>
          </>
        )}
      </div>

      <ThumbnailUpload course={course} onChanged={onChanged} />

      {course.lessons?.length > 0 && (
        <ol className="mt-3 space-y-1 rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
          {course.lessons.map((l) => (
            <li key={l._id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {l.order}. {l.title}
                {(l.youtubeId || l.videoObjectKey)
                  ? <Play className="h-3 w-3 text-green-600" />
                  : <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" /> no video</span>}
              </span>
              {l.isPreview && <Badge tone="brand">preview</Badge>}
            </li>
          ))}
        </ol>
      )}

      {missingVideo > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> {missingVideo} lesson{missingVideo === 1 ? '' : 's'} without a video won't be playable.
        </p>
      )}

      <AddLessonForm course={course} nextOrder={nextOrder} onChanged={onChanged} />

      {course.status === 'draft' && (
        <Button variant="outline" size="sm" className="mt-3" onClick={submit}>
          <Send className="h-3.5 w-3.5" /> Submit for review
        </Button>
      )}
    </Card>
  )
}

export default function InstructorDashboard() {
  const [courses, setCourses] = useState(null)
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
    <Layout>
      <Container className="max-w-3xl py-10">
        <h1 className="font-display text-2xl font-bold text-ink-900">Instructor dashboard</h1>

        <div className="mt-6 space-y-4">
          <NewCourseForm onCreated={refresh} />
          {courses?.length === 0 && (
            <EmptyState title="No courses yet" description="Create your first course above to get started." />
          )}
          {courses?.map((c) => <CourseRow key={c._id} course={c} onChanged={refresh} />)}
        </div>

        <h2 className="mt-10 flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
          <Wallet className="h-5 w-5 text-brand-600" /> Payouts
        </h2>
        <Card className="mt-3 p-5">
          <form onSubmit={requestPayout} className="flex gap-2">
            <Input type="number" placeholder="Amount NPR" required value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className="w-40" />
            <Button type="submit">Request payout</Button>
          </form>
          <ul className="mt-4 divide-y divide-ink-100 text-sm">
            {payouts.map((p) => (
              <li key={p._id} className="flex items-center justify-between py-2">
                <span>NPR {p.amountNPR.toLocaleString()}</span>
                <Badge tone={STATUS_TONE[p.status] || 'neutral'} className="capitalize">{p.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </Container>
    </Layout>
  )
}

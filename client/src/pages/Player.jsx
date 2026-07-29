import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Award, Captions, FileText, Headphones } from 'lucide-react'
import { api, API_URL } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

const PING_EVERY_SECONDS = 5

// load the YouTube IFrame API once, resolving when it's ready
let ytApiPromise
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        resolve(window.YT)
      }
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    })
  }
  return ytApiPromise
}

export default function Player() {
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | ready | denied
  const [error, setError] = useState(null)
  const [course, setCourse] = useState(null)
  const [source, setSource] = useState(null) // { provider, youtubeId } | { provider, streamUrl }
  const [completed, setCompleted] = useState(false)
  const [certificateId, setCertificateId] = useState(null)
  // accessibility / low-bandwidth preferences
  const [captionsOn, setCaptionsOn] = useState(true)
  const [audioOnly, setAudioOnly] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const lastPingedRef = useRef(0)
  const ytRef = useRef(null)
  const videoElRef = useRef(null)

  const sendPing = useCallback(async (delta) => {
    if (!(delta > 0)) return
    try {
      const res = await api.pingProgress(lessonId, delta)
      if (res.completed) setCompleted(true)
      if (res.certificateIssued) setCertificateId(res.certificateId)
    } catch {
      // a dropped ping just means slightly stale progress; the next one catches up
    }
  }, [lessonId])

  useEffect(() => {
    setStatus('loading')
    setSource(null)
    setCompleted(false)
    setCertificateId(null)
    lastPingedRef.current = 0
    api.getCourse(courseId).then(setCourse).catch(() => {})
    api
      .getSignedUrl(lessonId)
      .then((data) => {
        setSource(data)
        setStatus('ready')
      })
      .catch((err) => {
        setError(err.body?.error || err.message)
        setStatus('denied')
      })
  }, [courseId, lessonId])

  // YouTube lessons: build a player and report real elapsed time as progress pings
  useEffect(() => {
    if (source?.provider !== 'youtube') return undefined
    let player
    let interval
    let destroyed = false

    loadYouTubeApi().then((YT) => {
      if (destroyed || !ytRef.current) return
      player = new YT.Player(ytRef.current, {
        videoId: source.youtubeId,
        // cc_load_policy:1 forces captions on by default when the video has them (WCAG)
        playerVars: { rel: 0, modestbranding: 1, cc_load_policy: captionsOn ? 1 : 0, hl: 'en' },
        events: {
          onStateChange: (e) => {
            clearInterval(interval)
            if (e.data === YT.PlayerState.PLAYING) {
              interval = setInterval(() => {
                const t = Math.floor(player.getCurrentTime())
                if (t - lastPingedRef.current >= PING_EVERY_SECONDS) {
                  const delta = t - lastPingedRef.current
                  lastPingedRef.current = t
                  sendPing(delta)
                }
              }, 1000)
            }
            if (e.data === YT.PlayerState.ENDED) {
              const t = Math.floor(player.getDuration())
              sendPing(t - lastPingedRef.current)
              lastPingedRef.current = t
            }
          },
        },
      })
    })

    return () => {
      destroyed = true
      clearInterval(interval)
      player?.destroy?.()
    }
  }, [source, sendPing])

  // keep the file <video>'s caption track in sync with the toggle
  useEffect(() => {
    const el = videoElRef.current
    if (!el) return
    const tracks = el.textTracks
    for (let i = 0; i < tracks.length; i += 1) {
      tracks[i].mode = captionsOn ? 'showing' : 'hidden'
    }
  }, [captionsOn, source, audioOnly])

  const lessons = course?.lessons || []
  const currentIndex = lessons.findIndex((l) => l._id === lessonId)
  const currentLesson = currentIndex >= 0 ? lessons[currentIndex] : null
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson = currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null

  function handleTimeUpdate(e) {
    const current = Math.floor(e.target.currentTime)
    if (current - lastPingedRef.current >= PING_EVERY_SECONDS) {
      const delta = current - lastPingedRef.current
      lastPingedRef.current = current
      sendPing(delta)
    }
  }

  function handleEnded(e) {
    const current = Math.floor(e.target.currentTime)
    sendPing(current - lastPingedRef.current)
    lastPingedRef.current = current
  }

  if (status === 'loading') return <Layout><PageSpinner /></Layout>

  if (status === 'denied') {
    return (
      <Layout>
        <Container className="max-w-md py-20 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <p className="mt-3 font-display font-semibold text-ink-900">Can't play this lesson</p>
          <p className="mt-1 text-sm text-ink-500">{error}</p>
          <Button as={Link} to={`/courses/${courseId}`} variant="outline" className="mt-5">
            Back to course
          </Button>
        </Container>
      </Layout>
    )
  }

  return (
    <Layout footer={false}>
      <Container className="max-w-4xl py-8">
        <Link to={`/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700">
          <ArrowLeft className="h-4 w-4" /> Back to course
        </Link>

        <div className="mt-3">
          {course && <p className="text-sm text-ink-500">{course.title}</p>}
          <h1 className="font-display text-xl font-bold text-ink-900">
            {currentLesson ? currentLesson.title : 'Lesson'}
          </h1>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl bg-black">
          {source?.provider === 'youtube' ? (
            <div className="aspect-video w-full">
              <div ref={ytRef} className="h-full w-full" />
            </div>
          ) : audioOnly ? (
            // low-bandwidth mode: stream just the audio (a real audio-only rendition when
            // the instructor provided one, otherwise the video's audio track)
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-ink-900 px-6 text-center">
              <Headphones className="h-10 w-10 text-gold-400" />
              <p className="text-sm text-ink-200">Audio-only mode — saving your data</p>
              <audio
                key={(source?.audioStreamUrl || source?.streamUrl) + '-audio'}
                src={source ? `${API_URL}${source.audioStreamUrl || source.streamUrl}` : undefined}
                controls
                controlsList="nodownload"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="w-full max-w-md"
              />
            </div>
          ) : (
            <video
              ref={videoElRef}
              key={source?.streamUrl}
              src={source ? `${API_URL}${source.streamUrl}` : undefined}
              controls
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              // only needed to load a cross-origin caption track; left off otherwise so the
              // plain video path is unaffected
              crossOrigin={source?.captionsUrl ? 'anonymous' : undefined}
              className="aspect-video w-full"
            >
              {source?.captionsUrl && (
                <track
                  kind="captions"
                  src={source.captionsUrl.startsWith('/') ? `${API_URL}${source.captionsUrl}` : source.captionsUrl}
                  srcLang="en"
                  label="Captions"
                  default={captionsOn}
                />
              )}
            </video>
          )}
        </div>

        {/* Accessibility / low-bandwidth controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCaptionsOn((v) => !v)}
            aria-pressed={captionsOn}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              captionsOn ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:bg-ink-50'
            }`}
            title="Toggle captions"
          >
            <Captions className="h-4 w-4" /> Captions {captionsOn ? 'on' : 'off'}
          </button>

          {source?.provider === 'file' && (
            <button
              type="button"
              onClick={() => setAudioOnly((v) => !v)}
              aria-pressed={audioOnly}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                audioOnly ? 'border-gold-500 bg-gold-50 text-gold-700' : 'border-ink-200 text-ink-500 hover:bg-ink-50'
              }`}
              title="Audio-only / low-data mode"
            >
              <Headphones className="h-4 w-4" /> {audioOnly ? 'Audio-only on' : 'Low-data mode'}
            </button>
          )}

          {source?.transcript && (
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              aria-expanded={showTranscript}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                showTranscript ? 'border-ink-400 bg-ink-100 text-ink-800' : 'border-ink-200 text-ink-500 hover:bg-ink-50'
              }`}
              title="Show transcript"
            >
              <FileText className="h-4 w-4" /> Transcript
            </button>
          )}
        </div>

        {showTranscript && source?.transcript && (
          <Card className="mt-3 max-h-72 overflow-y-auto p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Transcript</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{source.transcript}</p>
          </Card>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={!prevLesson}
            onClick={() => prevLesson && navigate(`/learn/${courseId}/${prevLesson._id}`)}
          >
            <ArrowLeft className="h-4 w-4" /> Previous lesson
          </Button>
          <Button
            variant="outline"
            disabled={!nextLesson}
            onClick={() => nextLesson && navigate(`/learn/${courseId}/${nextLesson._id}`)}
          >
            Next lesson <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {completed && (
          <Alert tone="success" className="mt-4">
            Lesson complete.
            {certificateId && (
              <>
                {' '}Course finished — your certificate is ready in{' '}
                <Link to="/certificates" className="font-medium underline">My certificates</Link>.
              </>
            )}
          </Alert>
        )}

        {certificateId && (
          <Card className="mt-4 flex items-center gap-3 p-4">
            <Award className="h-6 w-6 text-gold-500" />
            <p className="text-sm text-ink-700">A signed completion certificate has been issued.</p>
          </Card>
        )}
      </Container>
    </Layout>
  )
}

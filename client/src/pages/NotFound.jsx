import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Button from '../components/ui/Button.jsx'

export default function NotFound() {
  return (
    <Layout>
      <Container className="flex flex-col items-center py-24 text-center">
        <Compass className="h-12 w-12 text-ink-300" strokeWidth={1.5} />
        <p className="mt-4 font-display text-3xl font-bold text-ink-900">Page not found</p>
        <p className="mt-2 text-ink-500">The page you're looking for doesn't exist or has moved.</p>
        <Button as={Link} to="/" className="mt-6">Back to courses</Button>
      </Container>
    </Layout>
  )
}

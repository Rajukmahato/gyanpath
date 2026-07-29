import { useEffect, useState } from 'react'
import { Check, Wallet, X } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState(null)

  function refresh() {
    api.pendingPayouts().then(setPayouts)
  }

  useEffect(refresh, [])

  async function review(id, decision) {
    await api.reviewPayout(id, decision)
    refresh()
  }

  return (
    <Layout>
      <Container className="max-w-3xl py-10">
        <h1 className="font-display text-2xl font-bold text-ink-900">Pending payouts</h1>

        <div className="mt-6 space-y-3">
          {payouts?.length === 0 && (
            <EmptyState icon={Wallet} title="Nothing pending" description="Instructor payout requests will show up here." />
          )}
          {payouts?.map((p) => (
            <Card key={p._id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-display font-semibold text-ink-900">NPR {p.amountNPR.toLocaleString()}</p>
                <p className="text-sm text-ink-400">{p.instructorId?.email}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => review(p._id, 'approved')}><Check className="h-4 w-4" /> Approve</Button>
                <Button size="sm" variant="outline" onClick={() => review(p._id, 'rejected')}><X className="h-4 w-4" /> Reject</Button>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </Layout>
  )
}

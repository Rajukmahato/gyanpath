import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Nav from '../components/Nav.jsx'

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState([])

  function refresh() {
    api.pendingPayouts().then(setPayouts)
  }

  useEffect(refresh, [])

  async function review(id, decision) {
    await api.reviewPayout(id, decision)
    refresh()
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">Pending payouts</h1>
        {payouts.length === 0 && <p className="text-gray-500">Nothing pending.</p>}
        {payouts.map((p) => (
          <div key={p._id} className="border rounded p-3 mb-2 flex justify-between items-center">
            <div>
              <p className="font-medium">NPR {p.amountNPR.toLocaleString()}</p>
              <p className="text-sm text-gray-500">{p.instructorId?.email}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => review(p._id, 'approved')} className="text-sm underline">Approve</button>
              <button onClick={() => review(p._id, 'rejected')} className="text-sm underline">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

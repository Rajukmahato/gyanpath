import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { api } from '../api/client.js'
import Nav from '../components/Nav.jsx'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

function PaymentForm() {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!stripe || !elements) return

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (confirmError) setError(confirmError.message)
    else setDone(true)
  }

  if (done) return <p>Payment submitted — you'll be enrolled once it's confirmed.</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={!stripe} className="bg-gray-900 text-white rounded px-4 py-2" type="submit">
        Pay
      </button>
    </form>
  )
}

export default function Checkout() {
  const { id } = useParams()
  const [clientSecret, setClientSecret] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.checkout(id).then((data) => setClientSecret(data.clientSecret)).catch((err) => setError(err.message))
  }, [id])

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-sm mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">Checkout</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm />
          </Elements>
        )}
      </div>
    </div>
  )
}

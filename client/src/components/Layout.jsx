import Header from './Header.jsx'
import Footer from './Footer.jsx'

export default function Layout({ children, footer = true }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">{children}</main>
      {footer && <Footer />}
    </div>
  )
}

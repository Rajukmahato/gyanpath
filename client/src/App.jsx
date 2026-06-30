import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Home from './pages/Home.jsx'
import Register from './pages/Register.jsx'
import VerifyOtp from './pages/VerifyOtp.jsx'
import Login from './pages/Login.jsx'
import MfaChallenge from './pages/MfaChallenge.jsx'
import MfaSetup from './pages/MfaSetup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/mfa-challenge" element={<MfaChallenge />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<RequireAuth />}>
            <Route path="/" element={<Home />} />
            <Route path="/mfa-setup" element={<MfaSetup />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

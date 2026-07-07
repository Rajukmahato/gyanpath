import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import RequireRole from './components/RequireRole.jsx'
import Browse from './pages/Browse.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import Checkout from './pages/Checkout.jsx'
import PaymentCallback from './pages/PaymentCallback.jsx'
import KhaltiReturn from './pages/KhaltiReturn.jsx'
import Player from './pages/Player.jsx'
import MyLearning from './pages/MyLearning.jsx'
import InstructorDashboard from './pages/InstructorDashboard.jsx'
import ModeratorQueue from './pages/ModeratorQueue.jsx'
import AdminPayouts from './pages/AdminPayouts.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Profile from './pages/Profile.jsx'
import Certificates from './pages/Certificates.jsx'
import VerifyCertificate from './pages/VerifyCertificate.jsx'
import Register from './pages/Register.jsx'
import VerifyOtp from './pages/VerifyOtp.jsx'
import Login from './pages/Login.jsx'
import MfaChallenge from './pages/MfaChallenge.jsx'
import MfaSetup from './pages/MfaSetup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import NotFound from './pages/NotFound.jsx'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/verify-certificate" element={<VerifyCertificate />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/mfa-challenge" element={<MfaChallenge />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<RequireAuth />}>
            <Route path="/mfa-setup" element={<MfaSetup />} />
            <Route path="/learn/:courseId/:lessonId" element={<Player />} />
            <Route path="/profile" element={<Profile />} />

            <Route element={<RequireRole roles={['student']} />}>
              <Route path="/checkout/:id" element={<Checkout />} />
              <Route path="/payment/khalti" element={<KhaltiReturn />} />
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/my-learning" element={<MyLearning />} />
              <Route path="/certificates" element={<Certificates />} />
            </Route>
            <Route element={<RequireRole roles={['instructor']} />}>
              <Route path="/instructor" element={<InstructorDashboard />} />
            </Route>
            <Route element={<RequireRole roles={['moderator', 'admin']} />}>
              <Route path="/moderator" element={<ModeratorQueue />} />
            </Route>
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/payouts" element={<AdminPayouts />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

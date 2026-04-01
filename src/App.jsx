import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import VerifyOtp from './pages/VerifyOtp.jsx'
import Appointment from './pages/Appointment.jsx'
import AppointmentDetail from './pages/AppointmentDetail.jsx'
import MyAppointments from './pages/MyAppointments.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/landing" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/home" element={<Home />} />
        <Route path="/appointments/:appointmentId" element={<AppointmentDetail />} />
        <Route path="/appointments" element={<Appointment />} />
        <Route path="/my-appointments" element={<MyAppointments />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

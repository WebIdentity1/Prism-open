import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardOverview from "./dashboard/DashboardOverview";
import StyleBoard from "./dashboard/StyleBoard";
import Appointments from "./dashboard/Appointments";
import SalonAppointments from "./dashboard/SalonAppointments";
import BookAppointment from "./dashboard/BookAppointment";
import Profile from "./dashboard/Profile";
import ConsultationQueue from "./dashboard/ConsultationQueue";
import Schedule from "./dashboard/Schedule";
import ClientList from "./dashboard/ClientList";
import SalonSettings from "./dashboard/SalonSettings";
import SalonOnboarding from "./dashboard/SalonOnboarding";
import StaffManagement from "./dashboard/StaffManagement";
import ServicesManager from "./dashboard/ServicesManager";
import Financials from "./dashboard/Financials";
import Payroll from "./dashboard/Payroll";
import Earnings from "./dashboard/Earnings";
import Reviews from "./dashboard/Reviews";
import AdminSettings from "./dashboard/AdminSettings";
import ConsultationDetail from "./dashboard/ConsultationDetail";
import Membership from "./dashboard/Membership";
import Campaigns from "./dashboard/Campaigns";
import Loyalty from "./dashboard/Loyalty";
import Messages from "./dashboard/Messages";
import Payments from "./dashboard/Payments";
import FormsManager from "./dashboard/FormsManager";
import VoiceAgent from "./dashboard/VoiceAgent";
import VoiceCallLogs from "./dashboard/VoiceCallLogs";
import StaffCalendar from "./dashboard/StaffCalendar";
import { useAuth } from "@/hooks/useAuth";

const Dashboard = () => {
  const { role } = useAuth(false);

  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="style-board" element={<StyleBoard />} />
        <Route path="book" element={<BookAppointment />} />
        <Route path="appointments" element={role === "salon_admin" ? <SalonAppointments /> : <Appointments />} />
        <Route path="calendar" element={<StaffCalendar />} />
        <Route path="profile" element={<Profile />} />
        <Route path="membership" element={<Membership />} />
        <Route path="consultations" element={<ConsultationQueue />} />
        <Route path="consultations/:id" element={<ConsultationDetail />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="clients" element={<ClientList />} />
        <Route path="salon" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="onboarding" element={<SalonOnboarding />} />
        <Route path="staff" element={<StaffManagement />} />
        <Route path="services" element={<ServicesManager />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="financials" element={<Financials />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="loyalty" element={<Loyalty />} />
        <Route path="messages" element={<Messages />} />
        <Route path="payments" element={<Payments />} />
        <Route path="forms" element={<FormsManager />} />
        <Route path="voice-agent" element={<VoiceAgent />} />
        <Route path="voice-call-logs" element={<VoiceCallLogs />} />
      </Routes>
    </DashboardLayout>
  );
};

export default Dashboard;

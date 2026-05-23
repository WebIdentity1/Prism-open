import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Gallery from "./pages/Gallery";
import Dashboard from "./pages/Dashboard";
import Consultation from "./pages/Consultation";
import NotFound from "./pages/NotFound";
import JoinSalon from "./pages/JoinSalon";
import StylistPortfolio from "./pages/StylistPortfolio";
import Salons from "./pages/Salons";
import SalonDetail from "./pages/SalonDetail";
import FormFill from "./pages/FormFill";
import ClientOnboarding from "./pages/ClientOnboarding";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/join/:salonId" element={<JoinSalon />} />
            <Route path="/salons" element={<Salons />} />
            <Route path="/salon/:salonId" element={<SalonDetail />} />
            <Route path="/stylist/:stylistId" element={<StylistPortfolio />} />
            <Route path="/form/:formId" element={<FormFill />} />
            <Route path="/onboard/:appointmentId" element={<ClientOnboarding />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
            <Route path="/consultation" element={<Consultation />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

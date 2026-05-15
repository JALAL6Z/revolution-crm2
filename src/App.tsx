import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Prospects from "@/pages/Prospects";
import ProspectDetail from "@/pages/ProspectDetail";
import Scraping from "@/pages/Scraping";
import Clients from "@/pages/Clients";
import Agents from "@/pages/Agents";
import Audits from "@/pages/Audits";
import Campagnes from "@/pages/Campagnes";
import Factures from "@/pages/Factures";
import Agenda from "@/pages/Agenda";
import Parametres from "@/pages/Parametres";
import Activity from "@/pages/Activity";
import Performance from "@/pages/Performance";
import CallScripts from "@/pages/CallScripts";
import Funnel from "@/pages/Funnel";
import GoogleAds from "@/pages/GoogleAds";
import Commissions from "@/pages/Commissions";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prospects" element={<Prospects />} />
            <Route path="/prospects/:id" element={<ProspectDetail />} />
            <Route path="/scraping" element={<Scraping />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/audits" element={<Audits />} />
            <Route path="/campagnes" element={<Campagnes />} />
            <Route path="/google-ads" element={<GoogleAds />} />
            <Route path="/commissions" element={<Commissions />} />
            <Route path="/factures" element={<Factures />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/funnel" element={<Funnel />} />
            <Route path="/scripts" element={<CallScripts />} />
            <Route path="/activite" element={<Activity />} />
            <Route path="/parametres" element={<Parametres />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

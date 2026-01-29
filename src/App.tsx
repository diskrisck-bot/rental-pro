import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import MobileMenuTrigger from "./components/layout/MobileMenuTrigger"; // Renamed import
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Timeline from "./pages/Timeline";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="flex min-h-screen w-full bg-gray-50">
          
          {/* 1. SIDEBAR (Só aparece no Desktop) */}
          <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
            <Sidebar /> 
          </aside>

          {/* 2. CONTEÚDO PRINCIPAL (Sempre visível, com margem no desktop) */}
          <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300">
            
            {/* 2.1 HEADER MOBILE (Só aparece no Mobile) */}
            <header className="md:hidden flex h-16 items-center justify-between px-4 border-b bg-white sticky top-0 z-40 shadow-sm">
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-600" />
                <span className="text-xl font-bold text-blue-600">RentalPro</span>
              </div>
              <MobileMenuTrigger /> 
            </header>

            {/* 2.2 O LUGAR ONDE AS PÁGINAS CARREGAM (Routes) */}
            <main className="flex-1 overflow-x-hidden">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import MobileNav from "./components/layout/MobileNav";
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
        <div className="flex bg-gray-50 min-h-screen"> {/* Mantendo min-h-screen aqui para garantir que o fundo cubra a tela */}
          {/* Sidebar fixa para desktop */}
          <div className="hidden md:block">
            <Sidebar />
          </div>
          
          <main className="flex-1 md:ml-64 flex flex-col"> {/* Adicionando flex-col para garantir que MobileNav e Routes se empilhem corretamente */}
            {/* Navbar e Menu Hambúrguer para mobile */}
            <MobileNav />
            
            <div className="flex-1"> {/* Garantindo que o conteúdo das rotas ocupe o restante do espaço */}
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
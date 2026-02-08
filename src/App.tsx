import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import Login from "./pages/Login";
import SignContract from "./pages/SignContract";
import { ThemeProvider } from "./components/theme-provider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="modern" defaultMode="system">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* --- ROTAS PÚBLICAS (Acessíveis sem Login) --- */}
            <Route path="/login" element={<Login />} />
            
            {/* AJUSTE AQUI: Mudamos de "/sign/" para "/contract/" para bater com o link do WhatsApp */}
            <Route path="/contract/:orderId" element={<SignContract />} />
            
            {/* --- ROTAS PROTEGIDAS (Exigem Login) --- */}
            {/* O "/*" pega qualquer coisa que não foi definida acima e joga para o layout protegido */}
            <Route path="/*" element={<ProtectedRoute> <MainLayout /> </ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
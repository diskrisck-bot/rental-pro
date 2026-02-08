"use client";

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from "./Sidebar";
import MobileHeader from "./MobileHeader"; 
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Orders from "@/pages/Orders";
import Timeline from "@/pages/Timeline";
import Settings from "@/pages/Settings"; 
import NotFound from "@/pages/NotFound";
// import ZapFlowButton from './ZapFlowButton'; // Importação removida

const MainLayout = () => (
  <div className="flex min-h-screen w-full bg-gray-50">
    
    {/* 1. SIDEBAR (Só aparece no Desktop) */}
    <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
      <Sidebar /> 
    </aside>

    {/* 2. CONTEÚDO PRINCIPAL (Sempre visível, com margem no desktop) */}
    <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300">
      
      {/* 2.1 HEADER MOBILE (Novo componente) */}
      <MobileHeader />

      {/* 2.2 O LUGAR ONDE AS PÁGINAS CARREGAM (Routes) */}
      <main className="flex-1 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/settings" element={<Settings />} /> 
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
    
    {/* 3. BOTÃO FLUTUANTE DE AÇÃO RÁPIDA (Removido) */}
    {/* <ZapFlowButton /> */}
  </div>
);

export default MainLayout;
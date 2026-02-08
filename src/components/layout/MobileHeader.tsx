"use client";

import React from 'react';
import { Package, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import MobileMenuTrigger from './MobileMenuTrigger';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const MobileHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Define se estamos em uma rota "interna" onde um botão de voltar faz sentido
  const isInternalRoute = location.pathname !== '/' && location.pathname !== '/login';

  if (!isMobile) return null;

  return (
    <header className="flex h-16 items-center justify-between px-4 border-b bg-card sticky top-0 z-40 shadow-sm">
      {isInternalRoute ? (
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6 text-muted-foreground" />
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-secondary" />
          <span className="text-xl font-heading font-extrabold text-secondary">RentalPro</span>
        </div>
      )}
      <MobileMenuTrigger /> 
    </header>
  );
};

export default MobileHeader;
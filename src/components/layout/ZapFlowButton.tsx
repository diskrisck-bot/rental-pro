"use client";

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ZapFlowButton = () => {
  // Este botão pode ser usado para abrir um modal de ação rápida ou um link direto
  const handleZapClick = () => {
    // Exemplo: Abrir um link de WhatsApp genérico ou um modal de atalho
    alert("Botão de Ação Rápida (ZapFlow) Clicado!");
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleZapClick}
          className="fixed bottom-8 right-8 h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#1DA851] shadow-xl transition-all duration-300 z-50 p-0"
          aria-label="Ações Rápidas WhatsApp"
        >
          <MessageCircle className="h-7 w-7 text-white" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        Ações Rápidas (WhatsApp)
      </TooltipContent>
    </Tooltip>
  );
};

export default ZapFlowButton;
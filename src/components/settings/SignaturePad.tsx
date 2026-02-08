"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onSave: (base64Image: string) => void;
  initialSignature?: string | null;
  disabled?: boolean;
  isSaving?: boolean; // Adicionado para refletir o estado de salvamento do pai
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, initialSignature, disabled = false, isSaving = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || isSaving) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    
    // Correção: Determina clientX/Y corretamente
    const isTouchEvent = 'touches' in e;
    const clientX = isTouchEvent ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouchEvent ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setIsEmpty(false);
  }, [disabled, isSaving]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || isSaving) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    
    // Correção: Determina clientX/Y corretamente
    const isTouchEvent = 'touches' in e;
    const clientX = isTouchEvent ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouchEvent ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  }, [isDrawing, disabled, isSaving]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
    }
  }, []);

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    // Ensure canvas is drawn on a white background before converting to PNG
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
    }
    
    const base64Image = tempCanvas.toDataURL('image/png');
    onSave(base64Image);
  }, [isEmpty, onSave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set canvas dimensions based on container size
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = 192; // Fixed height for h-48 equivalent
      }
      
      // Load initial signature if provided
      if (initialSignature) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before drawing
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setIsEmpty(false);
          };
          img.src = initialSignature;
        }
      } else {
        clearCanvas();
      }
    }
  }, [initialSignature, clearCanvas]);

  // Setup event listeners for drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing as any);
    canvas.addEventListener('mousemove', draw as any);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', startDrawing as any);
    canvas.addEventListener('touchmove', draw as any);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing as any);
      canvas.removeEventListener('mousemove', draw as any);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing as any);
      canvas.removeEventListener('touchmove', draw as any);
      canvas.removeEventListener('touchend', stopDrawing);
      canvas.removeEventListener('touchcancel', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing]);

  return (
    <div className="space-y-3">
      {/* 1. CONTAINER DA ASSINATURA */}
      <div className={cn(
        "w-full h-48 bg-white border-2 border-dashed border-gray-300 rounded-xl relative", // Aplicando classes estritas
        disabled || isSaving ? "opacity-60 cursor-not-allowed" : "hover:border-blue-400 transition-colors"
      )}>
        <canvas 
          ref={canvasRef} 
          className="w-full h-full" // Ocupa 100% do container (192px)
          style={{ touchAction: 'none' }} // Essencial para mobile UX
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
            {disabled || isSaving ? "Assinatura desabilitada" : "Desenhe sua assinatura aqui"}
          </div>
        )}
      </div>
      
      {/* 2. BOTÕES DE AÇÃO DA ASSINATURA: Grid responsivo */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={clearCanvas} 
          disabled={isEmpty || disabled || isSaving}
          className="w-full justify-center text-red-500 hover:bg-red-50"
        >
          <RotateCcw className="h-4 w-4 mr-2" /> Limpar
        </Button>
        <Button 
          type="button" 
          onClick={saveSignature} 
          disabled={isEmpty || disabled || isSaving}
          className="w-full justify-center bg-green-600 hover:bg-green-700"
        >
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
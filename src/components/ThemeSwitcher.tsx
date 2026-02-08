"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Zap, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const THEME_KEY = 'app-theme';
const INDUSTRIAL_THEME_VALUE = 'industrial';

interface ThemeSwitcherProps {
    isSidebar?: boolean;
}

const ThemeSwitcher = ({ isSidebar = false }: ThemeSwitcherProps) => {
  const [currentTheme, setCurrentTheme] = useState<'modern' | 'industrial'>('modern');

  const applyTheme = useCallback((theme: 'modern' | 'industrial') => {
    const html = document.documentElement;
    if (theme === 'industrial') {
      html.setAttribute('data-theme', INDUSTRIAL_THEME_VALUE);
      localStorage.setItem(THEME_KEY, INDUSTRIAL_THEME_VALUE);
    } else {
      html.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'modern');
    }
    setCurrentTheme(theme);
  }, []);

  useEffect(() => {
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === INDUSTRIAL_THEME_VALUE) {
      applyTheme('industrial');
    } else {
      applyTheme('modern');
    }
  }, [applyTheme]);

  const toggleTheme = () => {
    const newTheme = currentTheme === 'modern' ? 'industrial' : 'modern';
    applyTheme(newTheme);
  };

  const isIndustrial = currentTheme === 'industrial';
  const themeName = isIndustrial ? 'Industrial (Obra)' : 'Signature (Clean)';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="outline" 
          size={isSidebar ? "sm" : "icon"} 
          onClick={toggleTheme}
          className={cn(
            "shadow-custom border-border text-foreground",
            isSidebar ? "h-8 px-2 text-xs font-bold bg-secondary/50 text-white hover:bg-secondary/80" : "h-12 w-12"
          )}
        >
          {isSidebar ? (
            isIndustrial ? 'Industrial' : 'Signature'
          ) : (
            <Palette className="h-5 w-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="bg-secondary text-white border-none">
        Alternar para Tema: {themeName}
      </TooltipContent>
    </Tooltip>
  );
};

export default ThemeSwitcher;
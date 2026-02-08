"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Zap, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const THEME_KEY = 'app-theme';
const INDUSTRIAL_THEME_VALUE = 'industrial';

const ThemeSwitcher = () => {
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
  const themeName = isIndustrial ? 'Industrial (Laranja)' : 'Modern (Indigo)';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={toggleTheme}
          className="h-12 w-12 rounded-[var(--radius)] shadow-hard border-gray-300"
        >
          <Palette className="h-5 w-5 text-secondary" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="bg-secondary text-white border-none">
        Alternar para Tema: {themeName}
      </TooltipContent>
    </Tooltip>
  );
};

export default ThemeSwitcher;
"use client";

import * as React from "react";
import { Moon, Sun, Laptop, HardHat, Sparkles, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { setTheme, setMode, theme, mode } = useTheme();

  const CurrentThemeIcon = theme === 'industrial' ? HardHat : Sparkles;
  const CurrentModeIcon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Laptop;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="w-full justify-start px-3 h-10">
          <Palette className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">Tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Estilo da Aplicação</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => setTheme("modern")} className={theme === 'modern' ? 'bg-accent font-semibold' : ''}>
          <Sparkles className="mr-2 h-4 w-4 text-primary" />
          Moderno (Clean)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("industrial")} className={theme === 'industrial' ? 'bg-accent font-semibold' : ''}>
          <HardHat className="mr-2 h-4 w-4 text-primary" />
          Industrial (Obra)
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Modo de Cor</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => setMode("light")} className={mode === 'light' ? 'bg-accent font-semibold' : ''}>
          <Sun className="mr-2 h-4 w-4" />
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("dark")} className={mode === 'dark' ? 'bg-accent font-semibold' : ''}>
          <Moon className="mr-2 h-4 w-4" />
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("system")} className={mode === 'system' ? 'bg-accent font-semibold' : ''}>
          <Laptop className="mr-2 h-4 w-4" />
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
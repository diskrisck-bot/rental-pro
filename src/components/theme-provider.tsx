"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "modern" | "industrial";
type Mode = "light" | "dark" | "system";

interface ThemeProviderState {
  theme: Theme;
  mode: Mode;
  setTheme: (theme: Theme) => void;
  setMode: (mode: Mode) => void;
}

const initialState: ThemeProviderState = {
  theme: "modern",
  mode: "system",
  setTheme: () => null,
  setMode: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "modern",
  defaultMode = "system",
  storageKey = "rentalpro-theme",
  storageModeKey = "rentalpro-mode",
  ...props
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultMode?: Mode;
  storageKey?: string;
  storageModeKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  const [mode, setModeState] = useState<Mode>(
    () => (localStorage.getItem(storageModeKey) as Mode) || defaultMode
  );

  const applyTheme = useCallback((currentTheme: Theme, currentMode: Mode) => {
    const root = window.document.documentElement;
    
    // 1. Apply Theme (data-theme attribute)
    if (currentTheme === 'industrial') {
      root.setAttribute("data-theme", "industrial");
    } else {
      root.removeAttribute("data-theme"); // 'modern' is the default in :root
    }

    // 2. Apply Mode (dark class)
    root.classList.remove("light", "dark");

    if (currentMode === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(systemDark ? "dark" : "light");
    } else {
      root.classList.add(currentMode);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme, mode);
  }, [theme, mode, applyTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setThemeState(newTheme);
  }, [storageKey]);

  const setMode = useCallback((newMode: Mode) => {
    localStorage.setItem(storageModeKey, newMode);
    setModeState(newMode);
  }, [storageModeKey]);

  const value = {
    theme,
    mode,
    setTheme,
    setMode,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
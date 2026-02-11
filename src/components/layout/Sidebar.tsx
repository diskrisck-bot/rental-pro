"use client";

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Calendar as CalendarIcon,
  Settings,
  LogOut,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/integrations/supabase/auth';
import { showError } from '@/utils/toast';
import ThemeSwitcher from '../ThemeSwitcher'; // Import ThemeSwitcher

interface SidebarProps {
  onLinkClick?: () => void;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: CalendarIcon, label: 'Timeline', path: '/timeline' },
  { icon: ShoppingCart, label: 'Locações', path: '/orders' },
  { icon: Package, label: 'Inventário', path: '/inventory' },
];

const Sidebar = ({ onLinkClick }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error: any) {
      showError("Erro ao sair: " + error.message);
    }
    if (onLinkClick) onLinkClick();
  };

  return (
    <div className="w-64 bg-secondary border-r h-screen flex flex-col md:fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-heading font-extrabold flex items-center gap-2">
          <Package className="w-8 h-8 text-white" />
          <span className="text-white">Rental</span>
          <span className="text-primary italic">PRO</span>
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border-l-4",
                isActive 
                  ? "bg-primary text-white border-primary/80" 
                  : "text-gray-400 border-transparent hover:bg-secondary/80 hover:text-white" // Ajustado para text-gray-400
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-500")} /> {/* Ajustado para text-gray-500 */}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-secondary/80 space-y-3">
        <Link
          to="/settings"
          onClick={onLinkClick}
          className={cn(
            "flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium transition-colors border-l-4",
            location.pathname === '/settings' 
              ? "bg-primary text-white border-primary/80" 
              : "text-gray-400 border-transparent hover:bg-secondary/80 hover:text-white" // Ajustado para text-gray-400
          )}
        >
          <Settings className={cn("w-5 h-5", location.pathname === '/settings' ? "text-white" : "text-gray-500")} />
          Configurações
        </Link>
        
        {/* Theme Switcher integrado */}
        <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3 text-gray-400">
                <Palette className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium">Tema</span>
            </div>
            <ThemeSwitcher isSidebar={true} />
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-red-300 hover:bg-secondary/80 transition-colors"
        >
          <LogOut className="w-5 h-5 text-red-400" />
          Sair
        </button>
        <div className="text-xs text-gray-400 pt-2 text-center">
          v1.0.5
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
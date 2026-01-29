"use client";

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Calendar as CalendarIcon,
  Settings,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/integrations/supabase/auth';
import { showError } from '@/utils/toast';

interface SidebarProps {
  onLinkClick?: () => void;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: CalendarIcon, label: 'Timeline', path: '/timeline' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/orders' },
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
    <div className="w-64 bg-white border-r h-screen flex flex-col md:fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          <Package className="w-8 h-8" />
          RentalPro
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
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-blue-700" : "text-gray-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t space-y-1">
        <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <Settings className="w-5 h-5 text-gray-400" />
          Configurações
        </button>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5 text-red-400" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error("[ProtectedRoute] Error checking session:", error);
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    // Initial check
    checkSession();

    // Monitor auth state changes (Step 4 requirement)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setIsAuthenticated(true);
        if (window.location.pathname === '/login') {
          navigate('/', { replace: true });
        }
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || event === 'INITIAL_SESSION' && !session) {
        setIsAuthenticated(false);
        if (window.location.pathname !== '/login') {
          navigate('/login', { replace: true });
        }
      }
      // If we are still loading after an event, stop loading
      if (loading) setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Should already be redirected by useEffect, but return null just in case
    return null;
  }

  // If authenticated, render children or Outlet
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Loader2, Package, LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { showError } from '@/utils/toast';
import { signIn } from '@/integrations/supabase/auth';

const Login = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      // Success: Redirect to home
      navigate('/');
    } catch (error: any) {
      console.error("[Login] Authentication error:", error);
      showError(error.message || "Falha ao fazer login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <Card className="w-full max-w-md rounded-xl shadow-2xl border-4 border-blue-100">
        <CardHeader className="text-center space-y-2 pt-8">
          <div className="flex justify-center items-center gap-2 text-blue-600">
            <Package className="w-8 h-8" />
            <CardTitle className="text-3xl font-bold">RentalPro</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email', { required: 'Email é obrigatório' })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                {...register('password', { required: 'Senha é obrigatória' })}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message as string}</p>}
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 transition-all"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
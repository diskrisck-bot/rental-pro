"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, User, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import SignaturePad from '@/components/settings/SignaturePad';
import { Button } from '@/components/ui/button';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  default_signature_image: string | null;
}

// Helper function to fetch the current user's profile
const fetchProfile = async (): Promise<Profile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, default_signature_image')
    .eq('id', user.id)
    .single();

  // Se o erro for 'não encontrado' (código 406), retornamos null em vez de lançar erro.
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  // Se data for null, significa que o perfil não existe, retornamos um objeto base.
  if (!data) {
    return {
      id: user.id,
      first_name: '',
      last_name: '',
      default_signature_image: null,
    };
  }
  
  return data as Profile;
};

const Settings = () => {
  const queryClient = useQueryClient();
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['userProfile'],
    queryFn: fetchProfile,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (profile?.default_signature_image) {
      setCurrentSignature(profile.default_signature_image);
    }
  }, [profile]);

  const updateSignatureMutation = useMutation({
    mutationFn: async (base64Image: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // Usando upsert para garantir que o perfil seja criado se não existir
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          default_signature_image: base64Image 
        }, { onConflict: 'id' });

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Assinatura padrão salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (error: any) => {
      showError("Erro ao salvar assinatura: " + error.message);
    },
  });

  const handleSaveSignature = (base64Image: string) => {
    setCurrentSignature(base64Image);
    updateSignatureMutation.mutate(base64Image);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !profile) {
    // Se isError for true (erro diferente de 406) ou profile for null (o que não deve acontecer após a correção), mostramos erro.
    return <div className="p-8 text-center text-red-500">Erro ao carregar configurações.</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e dados de locador.</p>
      </div>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Assinatura Digital Padrão (Locador)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta assinatura será automaticamente aplicada em todos os contratos gerados para o cliente.
          </p>
          
          <SignaturePad 
            onSave={handleSaveSignature}
            initialSignature={currentSignature}
            isSaving={updateSignatureMutation.isPending}
          />
          
          {updateSignatureMutation.isPending && (
            <div className="flex items-center text-sm text-blue-600">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando assinatura...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
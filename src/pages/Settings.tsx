"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, User, Save, Building, Phone, MapPin, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SignaturePad from '@/components/settings/SignaturePad';
import { Button } from '@/components/ui/button';
import MaskedInput from 'react-text-mask';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Usamos esta interface para o estado local e para o payload de salvamento
interface CompanySettings {
  user_id: string;
  business_name: string;
  business_cnpj: string;
  business_address: string;
  business_phone: string;
  business_city: string;
  business_state: string;
  signature_url: string | null;
}

// Máscaras
const phoneMask = ['(', /[1-9]/, /\d/, ')', ' ', /\d/, /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/];
const cnpjMask = [/\d/, /\d/, '.', /\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, '/', /\d/, /\d/, /\d/, /\d/, '-', /\d/, /\d/];

// Helper function to fetch the current user's company settings
const fetchCompanySettings = async (): Promise<CompanySettings | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  // *** MUDANÇA CRÍTICA: Buscando de company_settings ***
  const { data, error } = await supabase
    .from('company_settings')
    .select('user_id, business_name, business_cnpj, business_address, business_phone, business_city, business_state, signature_url')
    .eq('user_id', user.id)
    .single();

  // Se o erro for 'não encontrado' (código 406), retornamos um objeto base.
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  const baseSettings: CompanySettings = {
    user_id: user.id,
    business_name: '',
    business_cnpj: '',
    business_address: '',
    business_phone: '',
    business_city: '',
    business_state: '',
    signature_url: null,
  };

  // Mapeia os dados retornados para a interface CompanySettings
  return data ? { ...baseSettings, ...data } : baseSettings;
};

const Settings = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Omit<CompanySettings, 'user_id'>>({
    business_name: '',
    business_cnpj: '',
    business_address: '',
    business_phone: '',
    business_city: '',
    business_state: '',
    signature_url: null,
  });
  const [isFormDirty, setIsFormDirty] = useState(false);
  // Removendo o estado userId, pois vamos buscá-lo na mutação
  // const [userId, setUserId] = useState<string | null>(null); 

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['companySettings'],
    queryFn: fetchCompanySettings,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (settings) {
      // setUserId(settings.user_id); // Não precisamos mais disso
      setFormData({
        business_name: settings.business_name || '',
        business_cnpj: settings.business_cnpj || '',
        business_address: settings.business_address || '',
        business_phone: settings.business_phone || '',
        business_city: settings.business_city || '',
        business_state: settings.business_state || '',
        signature_url: settings.signature_url,
      });
      setIsFormDirty(false);
    }
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value,
    }));
    setIsFormDirty(true);
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: Partial<CompanySettings>) => {
      // 1. Recuperar a sessão atual de forma robusta
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Lançar erro para ser capturado pelo onError
        throw new Error("ID do usuário não encontrado. Por favor, faça login novamente.");
      }
      const userId = user.id;

      // 2. Montar o payload com o user_id garantido
      const payloadWithId = { 
        user_id: userId, 
        ...payload 
      };
      
      // 3. Executar UPSERT
      const { error } = await supabase
        .from('company_settings')
        .upsert(payloadWithId, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Configurações salvas com sucesso!");
      setIsFormDirty(false);
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
      queryClient.invalidateQueries({ queryKey: ['orderDetails'] }); 
    },
    onError: (error: any) => {
      // Exibe a mensagem de erro capturada, incluindo a mensagem de "ID do usuário não encontrado"
      showError("Erro ao salvar configurações: " + error.message);
    },
  });

  const handleSaveSignature = (base64Image: string) => {
    updateSettingsMutation.mutate({ signature_url: base64Image });
    setFormData(prev => ({ ...prev, signature_url: base64Image }));
  };
  
  const handleSaveDetails = () => {
    if (!isFormDirty) return;
    
    const payload = {
      business_name: formData.business_name,
      business_cnpj: formData.business_cnpj,
      business_address: formData.business_address,
      business_phone: formData.business_phone,
      business_city: formData.business_city,
      business_state: formData.business_state,
    };
    
    updateSettingsMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isSaving = updateSettingsMutation.isPending;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e dados de locador.</p>
      </div>
      
      {isError && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao Carregar Dados</AlertTitle>
          <AlertDescription>
            Houve uma falha ao buscar as configurações existentes. Por favor, preencha os campos e clique em Salvar para criar o registro.
          </AlertDescription>
        </Alert>
      )}

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-600" />
            Dados Jurídicos da Empresa (Locador)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Estas informações serão usadas para preencher o cabeçalho dos contratos de locação.
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="business_name">Nome da Empresa / Razão Social</Label>
            <Input 
              id="business_name" 
              value={formData.business_name} 
              onChange={handleChange}
              placeholder="Ex: RentalPro Locações LTDA"
              disabled={isSaving}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business_cnpj">CNPJ / CPF</Label>
              <MaskedInput
                mask={cnpjMask}
                placeholder="XX.XXX.XXX/XXXX-XX"
                id="business_cnpj"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.business_cnpj}
                onChange={handleChange}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_phone">Telefone / WhatsApp</Label>
              <MaskedInput
                mask={phoneMask}
                placeholder="(XX) XXXXX-XXXX"
                id="business_phone"
                type="tel"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.business_phone}
                onChange={handleChange}
                disabled={isSaving}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="business_address">Endereço Completo</Label>
            <Input 
              id="business_address" 
              value={formData.business_address} 
              onChange={handleChange}
              placeholder="Ex: Rua das Flores, 123, Centro, São Paulo - SP"
              disabled={isSaving}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business_city">Cidade (Para Cláusula de Foro)</Label>
              <Input 
                id="business_city" 
                value={formData.business_city} 
                onChange={handleChange}
                placeholder="Ex: São Paulo"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_state">Estado (UF)</Label>
              <Input 
                id="business_state" 
                value={formData.business_state} 
                onChange={handleChange}
                placeholder="Ex: SP"
                disabled={isSaving}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleSaveDetails} 
            disabled={!isFormDirty || isSaving}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 mt-4"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Salvar Detalhes da Empresa
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Assinatura Digital Padrão (Locador)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta assinatura será automaticamente aplicada em todos os contratos gerados.
          </p>
          
          <SignaturePad 
            onSave={handleSaveSignature}
            initialSignature={formData.signature_url}
            isSaving={isSaving}
          />
          
          {isSaving && (
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
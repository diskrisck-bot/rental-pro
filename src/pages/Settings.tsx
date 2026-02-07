"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import SignaturePad from '@/components/settings/SignaturePad';
import { Loader2, Building, Save, MapPin } from 'lucide-react';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Estados do Formulário
  const [businessName, setBusinessName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(''); // NOVO CAMPO
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setBusinessName(data.business_name || '');
        setCnpj(data.business_cnpj || '');
        setPhone(data.business_phone || '');
        setAddress(data.business_address || '');
        setCity(data.business_city || ''); // Carrega a cidade
        setSignatureUrl(data.signature_url);
      }
    } catch (error: any) {
      showError('Erro ao carregar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      const updates = {
        id: user.id,
        business_name: businessName,
        business_cnpj: cnpj,
        business_phone: phone,
        business_address: address,
        business_city: city, // Salva a cidade
        signature_url: signatureUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      showSuccess('Configurações salvas com sucesso!');
    } catch (error: any) {
      showError('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie os dados da sua locadora que aparecerão no contrato.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
            <Building className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Dados Jurídicos da Empresa</h2>
        </div>

        <div className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa / Razão Social</Label>
            <Input 
              id="name" 
              value={businessName} 
              onChange={(e) => setBusinessName(e.target.value)} 
              placeholder="Ex: RentalPro Locações LTDA"
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ / CPF</Label>
              <Input 
                id="cnpj" 
                value={cnpj} 
                onChange={(e) => setCnpj(e.target.value)} 
                placeholder="00.000.000/0001-00"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input 
                id="phone" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="(00) 00000-0000"
                className="h-11"
              />
            </div>
          </div>

          {/* ENDEREÇO E CIDADE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="address">Endereço Completo</Label>
              <Input 
                id="address" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="Rua Exemplo, 123 - Bairro"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city" className="flex items-center gap-1">
                 Cidade / UF <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="city" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)} 
                  placeholder="Ex: Rio de Janeiro - RJ"
                  className="pl-9 h-11 border-blue-200 focus:border-blue-500 bg-blue-50/30"
                />
              </div>
              <p className="text-[10px] text-gray-500">Usado para definir o Foro e a data do contrato.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DE ASSINATURA PADRÃO */}
      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Assinatura Digital do Locador</h2>
          <p className="text-sm text-gray-500">Esta assinatura será aplicada automaticamente nos contratos gerados.</p>
        </div>
        
        <div className="max-w-md">
           <SignaturePad 
             initialUrl={signatureUrl} 
             onSave={(url) => setSignatureUrl(url)} 
           />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-end md:static md:bg-transparent md:border-0 md:p-0">
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="w-full md:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-lg shadow-lg"
        >
          {saving ? <><Loader2 className="animate-spin mr-2" /> Salvando...</> : <><Save className="mr-2" /> Salvar Configurações</>}
        </Button>
      </div>
    </div>
  );
};

export default Settings;
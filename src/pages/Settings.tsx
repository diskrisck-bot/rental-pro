"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import SignaturePad from '@/components/settings/SignaturePad';
import { Loader2, Building, Save, MapPin, PenTool } from 'lucide-react';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Estados do Formulário
  const [userId, setUserId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(''); 
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

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
        setCity(data.business_city || '');
        setSignatureUrl(data.signature_url);
      }
    } catch (error: any) {
      showError('Erro ao carregar perfil.');
    } finally {
      setLoading(false);
    }
  };

  // Função Geral (Salva textos e cidade)
  const handleSaveData = async () => {
    setSaving(true);
    try {
      if (!userId) throw new Error("Usuário não autenticado");

      const updates = {
        id: userId,
        business_name: businessName,
        business_cnpj: cnpj,
        business_phone: phone,
        business_address: address,
        business_city: city, // Garante que a cidade seja salva
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      showSuccess('Dados da empresa salvos com sucesso!');
    } catch (error: any) {
      showError('Erro ao salvar dados: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Função Específica para o Botão Verde (Salva Assinatura Imediatamente)
  const handleSaveSignature = async (url: string) => {
    try {
      if (!userId) return;
      
      // Atualiza visualmente
      setSignatureUrl(url);

      // Envia para o banco IMEDIATAMENTE
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId,
          signature_url: url,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      showSuccess('Assinatura digital gravada com sucesso!');
    } catch (error: any) {
      showError('Erro ao gravar assinatura: ' + error.message);
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 pb-24">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações da Locadora</h1>
        <p className="text-gray-500">Defina os dados que aparecerão no cabeçalho e rodapé dos contratos.</p>
      </div>

      {/* BLOCO 1: DADOS TEXTUAIS */}
      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Dados Jurídicos</h2>
            <p className="text-xs text-gray-500">Informações obrigatórias para o contrato.</p>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="space-y-2">
            <Label>Nome da Empresa (Razão Social)</Label>
            <Input 
              value={businessName} 
              onChange={(e) => setBusinessName(e.target.value)} 
              placeholder="Ex: RentalPro Equipamentos LTDA"
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input 
                value={cnpj} 
                onChange={(e) => setCnpj(e.target.value)} 
                placeholder="00.000.000/0001-00"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone / WhatsApp</Label>
              <Input 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="(21) 99999-9999"
                className="h-11"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Endereço</Label>
              <Input 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="Rua, Número, Bairro"
                className="h-11"
              />
            </div>
            {/* CAMPO DE CIDADE CORRIGIDO */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-blue-700 font-bold">
                 Cidade / UF <MapPin className="h-3 w-3" />
              </Label>
              <Input 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="Rio de Janeiro - RJ"
                className="h-11 border-blue-200 bg-blue-50/50"
              />
            </div>
          </div>
        </div>
        
        <div className="pt-4">
            <Button 
            onClick={handleSaveData} 
            disabled={saving} 
            className="w-full md:w-auto bg-slate-800 hover:bg-slate-900"
            >
            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Dados da Empresa
            </Button>
        </div>
      </div>

      {/* BLOCO 2: ASSINATURA (INDEPENDENTE) */}
      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <div className="p-2 bg-green-100 rounded-lg text-green-700">
            <PenTool className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Assinatura do Locador</h2>
            <p className="text-xs text-gray-500">Desenhe sua rubrica abaixo e clique no botão verde para gravar.</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-full max-w-md">
                {/* Aqui passamos a função que salva direto no banco */}
                <SignaturePad 
                    initialUrl={signatureUrl} 
                    onSave={handleSaveSignature} 
                />
            </div>
            
            <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border">
                <p className="font-bold mb-2">Como funciona?</p>
                <p>1. Desenhe sua assinatura no quadro.</p>
                <p>2. Clique no botão <strong>verde</strong> ("Salvar Assinatura").</p>
                <p>3. Aguarde a mensagem de sucesso.</p>
                <p className="mt-2 text-xs italic">Isso garantirá que ela apareça automaticamente no campo "LOCADOR" dos contratos PDF.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
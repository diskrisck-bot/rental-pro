"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import SignaturePad from '@/components/settings/SignaturePad';
import { Loader2, Building, Save, MapPin, PenTool, CheckCircle, Trash2 } from 'lucide-react';

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

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setBusinessName(data.business_name || '');
        setCnpj(data.business_cnpj || '');
        setPhone(data.business_phone || '');
        setAddress(data.business_address || '');
        setCity(data.business_city || '');
        setSignatureUrl(data.signature_url);
      }
    } catch (error: any) { showError('Erro ao carregar perfil.'); } finally { setLoading(false); }
  };

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
        business_city: city, 
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      showSuccess('Dados da empresa salvos com sucesso!');
    } catch (error: any) { showError('Erro ao salvar dados: ' + error.message); } finally { setSaving(false); }
  };

  const handleSaveSignature = async (url: string) => {
    try {
      if (!userId) return;
      setSignatureUrl(url); // Atualiza a pré-visualização na hora
      const { error } = await supabase.from('profiles').upsert({ 
          id: userId,
          signature_url: url,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      showSuccess('Assinatura gravada com sucesso!');
    } catch (error: any) { showError('Erro ao gravar assinatura.'); }
  };

  const handleClearSignature = async () => {
    if(!window.confirm("Deseja apagar sua assinatura atual?")) return;
    try {
        if (!userId) return;
        setSignatureUrl(null);
        await supabase.from('profiles').upsert({ id: userId, signature_url: null, updated_at: new Date().toISOString() });
        showSuccess("Assinatura removida.");
    } catch (e) { showError("Erro ao remover."); }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 pb-24">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Dados cadastrais e assinatura digital.</p>
      </div>

      {/* DADOS DA EMPRESA */}
      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-700"><Building className="h-5 w-5" /></div>
          <h2 className="text-lg font-bold text-gray-800">Dados da Empresa</h2>
        </div>
        <div className="grid gap-6">
          <div className="space-y-2"><Label>Nome Fantasia</Label><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ex: RentalPro Locações" className="h-11"/></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="h-11"/></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-11"/></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2"><Label>Endereço</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, Número" className="h-11"/></div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-blue-700 font-bold">Cidade / UF <MapPin className="h-3 w-3" /></Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade - UF" className="h-11 border-blue-200 bg-blue-50/50"/>
            </div>
          </div>
        </div>
        <Button onClick={handleSaveData} disabled={saving} className="w-full md:w-auto bg-slate-800"><Save className="mr-2 h-4 w-4" /> Salvar Dados</Button>
      </div>

      {/* ASSINATURA */}
      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <div className="p-2 bg-green-100 rounded-lg text-green-700"><PenTool className="h-5 w-5" /></div>
          <div><h2 className="text-lg font-bold text-gray-800">Assinatura Digital</h2><p className="text-xs text-gray-500">Usada automaticamente no campo "LOCADOR".</p></div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
            {/* COLUNA 1: PAD DE DESENHO */}
            <div className="space-y-2">
                <Label className="font-bold text-gray-700">Nova Assinatura:</Label>
                <div className="border rounded-lg overflow-hidden">
                    <SignaturePad onSave={handleSaveSignature} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Desenhe e clique no botão verde do quadro para salvar.</p>
            </div>

            {/* COLUNA 2: PRÉ-VISUALIZAÇÃO (AQUI ESTÁ A CORREÇÃO) */}
            <div className="space-y-2">
                <Label className="font-bold text-gray-700">Assinatura Atual Salva:</Label>
                {signatureUrl ? (
                    <div className="relative border-2 border-dashed border-green-300 bg-green-50 rounded-lg h-48 flex flex-col items-center justify-center p-4">
                        <img src={signatureUrl} alt="Assinatura Salva" className="max-h-32 object-contain" />
                        <div className="absolute top-2 right-2 flex gap-2">
                            <span className="bg-green-200 text-green-800 text-[10px] px-2 py-1 rounded-full font-bold flex items-center shadow-sm">
                                <CheckCircle className="w-3 h-3 mr-1"/> SALVA
                            </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleClearSignature} className="mt-4 text-red-500 hover:text-red-700 hover:bg-red-50 h-8 text-xs">
                            <Trash2 className="w-3 h-3 mr-1"/> Apagar
                        </Button>
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-lg h-48 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                        <PenTool className="h-8 w-8 mb-2 opacity-20"/>
                        <p className="text-sm">Nenhuma assinatura gravada.</p>
                        <p className="text-xs">Desenhe ao lado para configurar.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
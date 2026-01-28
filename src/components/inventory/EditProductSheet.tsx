"use client";

import React, { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AssetManagement from './AssetManagement';

// Tipagem básica para os dados da view (incluindo active_rentals para validação)
interface InventoryItem {
  id: string;
  name: string;
  type: 'trackable' | 'bulk';
  price: number;
  total_quantity: number;
  active_rentals: number;
  available_quantity: number;
}

interface EditProductSheetProps {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditProductSheet = ({ productId, open, onOpenChange }: EditProductSheetProps) => {
  const queryClient = useQueryClient();
  const [productData, setProductData] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'trackable',
    total_quantity: 1,
    price: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  // 1. Carregar dados do produto (da view, que contém active_rentals)
  useEffect(() => {
    if (open && productId) {
      const fetchProduct = async () => {
        setLoading(true);
        try {
          // Busca os dados da view inventory_analytics para ter o active_rentals
          const { data, error } = await supabase
            .from('inventory_analytics')
            .select('*')
            .eq('id', productId)
            .single();

          if (error) throw error;
          
          setProductData(data as InventoryItem);
          setFormData({
            name: data.name,
            type: data.type,
            total_quantity: data.total_quantity,
            price: Number(data.price),
          });
          setActiveTab('details'); // Volta para a aba de detalhes ao abrir
        } catch (error: any) {
          showError("Erro ao carregar dados do produto: " + error.message);
          onOpenChange(false);
        } finally {
          setLoading(false);
        }
      };
      fetchProduct();
    }
  }, [open, productId, onOpenChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'number' ? parseFloat(value) || parseInt(value) || 0 : value,
    }));
  };

  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSave = async () => {
    if (!productId || !productData) return;

    const newTotalQuantity = formData.total_quantity;
    const activeRentals = productData.active_rentals;

    // 4. Tratamento de Erro: Validação de estoque
    if (newTotalQuantity < activeRentals) {
      showError(`Não é possível reduzir o estoque total para ${newTotalQuantity}, pois ${activeRentals} unidades estão alugadas no momento.`);
      return;
    }

    try {
      setSaving(true);
      
      // Lógica de UPDATE estrita na tabela 'products' com validação de retorno
      const { data, error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          type: formData.type,
          total_quantity: Number(newTotalQuantity),
          price: Number(formData.price),
        })
        .eq('id', productId)
        .select(); // Adiciona .select() para obter o retorno

      if (error) {
        console.error("[EditProductSheet] Erro fatal no Supabase:", error);
        throw error; 
      }
      
      // VALIDAÇÃO CRÍTICA: Verifica se alguma linha foi realmente atualizada
      if (!data || data.length === 0) {
        throw new Error("Erro: A atualização foi ignorada pelo banco. Verifique as permissões (RLS) ou se o ID do produto está correto.");
      }

      showSuccess("Produto atualizado com sucesso!");
      
      // Invalida as queries para forçar a atualização dos dados em todas as telas
      queryClient.invalidateQueries({ queryKey: ['inventoryAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['timelineData'] });
      queryClient.invalidateQueries({ queryKey: ['allProducts'] });
      
      onOpenChange(false);
    } catch (error: any) {
      // Tratamento de erro real
      showError("Erro ao salvar produto: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // O botão de salvar só deve estar ativo na aba de detalhes
  const isSaveDisabled = activeTab !== 'details' || saving || loading || !productData;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>Editar Produto</SheetTitle>
          <p className="text-xs font-mono text-muted-foreground">ID: #{productId?.split('-')[0]}</p>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground mt-2">Carregando dados...</p>
          </div>
        ) : productData ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="assets" disabled={productData.type === 'bulk'}>Ativos (Seriais)</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto py-6">
              <TabsContent value="details" className="mt-0 space-y-6">
                {/* Informação de Aluguel Ativo */}
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-orange-800">
                    <p className="font-semibold">Alugados Ativos: {productData.active_rentals}</p>
                    <p className="text-xs mt-1">A Quantidade Total não pode ser menor que este número.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Produto</Label>
                    <Input 
                      id="name" 
                      value={formData.name} 
                      onChange={handleChange}
                      placeholder="Nome do Produto" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select 
                        value={formData.type} 
                        onValueChange={(val) => handleSelectChange('type', val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trackable">Rastreável (Serial)</SelectItem>
                          <SelectItem value="bulk">Granel (Quantidade)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_quantity">Quantidade Total</Label>
                      <Input 
                        id="total_quantity" 
                        type="number"
                        min={productData.active_rentals} // Mínimo baseado no que está alugado
                        value={formData.total_quantity} 
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço da Diária (R$)</Label>
                    <Input 
                      id="price" 
                      type="number"
                      step="0.01"
                      value={formData.price} 
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="assets" className="mt-0">
                <AssetManagement 
                  productId={productId} 
                  productType={productData.type} 
                />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Produto não encontrado.
          </div>
        )}

        <SheetFooter className="mt-auto pt-6 border-t sm:flex-col gap-2">
          <Button 
            className="w-full h-12 bg-blue-600 hover:bg-blue-700" 
            onClick={handleSave}
            disabled={isSaveDisabled}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            {activeTab === 'details' ? 'Salvar Detalhes' : 'Salvar (Detalhes)'}
          </Button>
          <Button variant="outline" className="w-full h-12" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default EditProductSheet;
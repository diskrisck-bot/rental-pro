"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { fetchProductAssets } from '@/integrations/supabase/queries';
import { showError, showSuccess } from '@/utils/toast';

interface AssetManagementProps {
  productId: string;
  productType: 'trackable' | 'bulk';
}

interface Asset {
  id: string;
  serial_number: string;
  created_at: string;
}

const AssetManagement = ({ productId, productType }: AssetManagementProps) => {
  const queryClient = useQueryClient();
  const [newSerialNumber, setNewSerialNumber] = useState('');

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['productAssets', productId],
    queryFn: () => fetchProductAssets(productId),
    enabled: productType === 'trackable',
  });

  const addAssetMutation = useMutation({
    mutationFn: async (serialNumber: string) => {
      const { error } = await supabase
        .from('assets')
        .insert([{ product_id: productId, serial_number: serialNumber }]);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Número de série adicionado com sucesso!');
      setNewSerialNumber('');
      queryClient.invalidateQueries({ queryKey: ['productAssets', productId] });
      queryClient.invalidateQueries({ queryKey: ['inventoryAnalytics'] }); // Atualiza a contagem total
    },
    onError: (error: any) => {
      showError('Erro ao adicionar número de série: ' + error.message);
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Número de série removido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['productAssets', productId] });
      queryClient.invalidateQueries({ queryKey: ['inventoryAnalytics'] }); // Atualiza a contagem total
    },
    onError: (error: any) => {
      showError('Erro ao remover número de série: ' + error.message);
    },
  });

  const handleAddAsset = () => {
    if (newSerialNumber.trim()) {
      addAssetMutation.mutate(newSerialNumber.trim());
    }
  };

  if (productType === 'bulk') {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg border border-dashed text-muted-foreground">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-primary" />
        <p className="font-semibold">Produto de Granel</p>
        <p className="text-sm">Este produto é gerenciado por quantidade total, não por números de série individuais.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="new-serial">Adicionar Novo Número de Série</Label>
        <div className="flex gap-2">
          <Input
            id="new-serial"
            placeholder="Ex: SN-A7III-001"
            value={newSerialNumber}
            onChange={(e) => setNewSerialNumber(e.target.value)}
            disabled={addAssetMutation.isPending}
          />
          <Button 
            onClick={handleAddAsset} 
            disabled={!newSerialNumber.trim() || addAssetMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {addAssetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Lista de Ativos ({assets?.length || 0})</h3>
        
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : assets && assets.length > 0 ? (
          <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
            {assets.map((asset) => (
              <div key={asset.id} className="flex justify-between items-center p-3 hover:bg-gray-50 transition-colors">
                <span className="font-mono text-sm text-gray-700">{asset.serial_number}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteAssetMutation.mutate(asset.id)}
                  disabled={deleteAssetMutation.isPending}
                  className="text-red-500 hover:bg-red-50"
                >
                  {deleteAssetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-4 border-2 border-dashed rounded-lg">
            Nenhum número de série cadastrado.
          </p>
        )}
      </div>
    </div>
  );
};

export default AssetManagement;
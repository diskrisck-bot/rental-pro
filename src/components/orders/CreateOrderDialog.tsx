"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
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
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';

interface CreateOrderDialogProps {
  onOrderCreated: () => void;
  children: React.ReactNode;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

const CreateOrderDialog = ({ onOrderCreated, children }: CreateOrderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  
  // Estados para o item atual que está sendo adicionado
  const [currentProductId, setCurrentProductId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      customer_name: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
    }
  });

  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open]);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) showError("Erro ao carregar produtos");
    else setProducts(data || []);
  };

  const addItem = () => {
    if (!currentProductId) return;
    
    const product = products.find(p => p.id === currentProductId);
    if (!product) return;

    const newItem: OrderItem = {
      product_id: currentProductId,
      product_name: product.name,
      quantity: currentQuantity
    };

    setSelectedItems([...selectedItems, newItem]);
    setCurrentProductId("");
    setCurrentQuantity(1);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: any) => {
    if (selectedItems.length === 0) {
      showError("Adicione pelo menos um item ao pedido");
      return;
    }

    try {
      setLoading(true);

      // 1. Inserir o pedido
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_name: values.customer_name,
          start_date: new Date(values.start_date).toISOString(),
          end_date: new Date(values.end_date).toISOString(),
          status: 'reserved'
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Inserir itens do pedido
      const itemsToInsert = selectedItems.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      showSuccess("Pedido criado com sucesso!");
      setOpen(false);
      reset();
      setSelectedItems([]);
      onOrderCreated();
    } catch (error: any) {
      showError("Erro ao criar pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Locação</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Nome do Cliente</Label>
              <Input 
                id="customer_name" 
                placeholder="Ex: João Silva" 
                {...register('customer_name', { required: true })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data Início</Label>
                <Input 
                  id="start_date" 
                  type="date" 
                  {...register('start_date', { required: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Data Fim</Label>
                <Input 
                  id="end_date" 
                  type="date" 
                  {...register('end_date', { required: true })}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-base font-semibold">Seleção de Produtos</Label>
            <div className="flex gap-4 mt-2 items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-xs text-muted-foreground">Produto</Label>
                <Select value={currentProductId} onValueChange={setCurrentProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-2">
                <Label className="text-xs text-muted-foreground">Qtd</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={currentQuantity} 
                  onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <Button type="button" onClick={addItem} variant="secondary">
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {selectedItems.length > 0 ? (
                <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                      <span className="text-sm font-medium">{item.product_name} x {item.quantity}</span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                  Nenhum item adicionado ao carrinho.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;
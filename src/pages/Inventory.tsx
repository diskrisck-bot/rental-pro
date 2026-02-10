"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter, Loader2, Edit, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import EditProductSheet from '@/components/inventory/EditProductSheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { startOfDay, parseISO } from 'date-fns';

// Tipagem
interface InventoryItem {
  id: string;
  name: string;
  type: 'trackable' | 'bulk';
  price: number;
  total_quantity: number;
  active_rentals: number;
  available_quantity: number;
}

const getAvailabilityStatus = (available: number, total: number) => {
  const percentage = total > 0 ? (available / total) : 0;

  if (available <= 0) {
    return { 
      color: 'text-red-600 font-bold', 
      badge: <Badge variant="destructive" className="ml-2 bg-red-100 text-red-800">Esgotado</Badge>,
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />
    };
  }
  if (percentage <= 0.2) { 
    return { 
      color: 'text-primary font-bold', 
      badge: <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">Baixo Estoque</Badge>,
      icon: <AlertTriangle className="h-4 w-4 text-primary" />
    };
  }
  return { 
    color: 'text-green-600 font-bold', 
    badge: null,
    icon: <CheckCircle className="h-4 w-4 text-green-500" />
  };
};

const ProductCardMobile = ({ product, available, handleEditProduct }: { product: any, available: number, handleEditProduct: (id: string) => void }) => {
  const status = getAvailabilityStatus(available, product.total_quantity);
  const rented = product.total_quantity - available;
  
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-secondary" />
          <div>
            <h3 className="font-bold text-lg">{product.name}</h3>
            <Badge variant={product.type === 'trackable' ? 'secondary' : 'default'} className="capitalize text-xs">
              {product.type === 'trackable' ? 'Rastreável' : 'Granel'}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product.id)}><Edit className="h-4 w-4 text-gray-500" /></Button>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center border-t pt-3">
        <div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{product.total_quantity}</p></div>
        <div><p className="text-xs text-muted-foreground">Alugados</p><p className="font-semibold text-secondary">{rented}</p></div>
        <div><p className="text-xs text-muted-foreground">Diária</p><p className="font-semibold">R$ {Number(product.price).toFixed(2)}</p></div>
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-sm font-semibold text-gray-700">Disponível Hoje:</p>
        <div className="flex items-center gap-2"><span className={cn("text-lg", status.color)}>{available}</span>{status.icon}</div>
      </div>
    </div>
  );
};

const Inventory = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [newProduct, setNewProduct] = useState({ name: '', type: 'trackable', total_quantity: 1, price: 0, serial_number: '' });

  // 1. QUERY DE PRODUTOS
  const { data: rawProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ['allProducts'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      return data || [];
    }
  });

  // 2. QUERY DE PEDIDOS ATIVOS (REGRA: Apenas 'picked_up' conta como estoque fora)
  const { data: activeOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['inventoryActiveOrders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select('quantity, product_id, orders!inner(status)')
        .eq('orders.status', 'picked_up'); // REGRA: Apenas o que saiu fisicamente
      return data || [];
    }
  });

  // REGRA DE OURO: O item só sai do estoque quando o status é 'picked_up' (Em andamento)
  const calculateStock = (productId: string, total: number) => {
    if (!activeOrders) return { available: total, rented: 0 };

    const rentedToday = activeOrders
      .filter((item: any) => item.product_id === productId)
      .reduce((acc: number, item: any) => acc + item.quantity, 0);

    return { available: Math.max(0, total - rentedToday), rented: rentedToday };
  };

  const handleCreateProduct = async () => {
    if (newProduct.type === 'trackable' && !newProduct.serial_number.trim()) { showError("Produtos rastreáveis requerem um Número de Série inicial."); return; }
    if (newProduct.type === 'trackable' && newProduct.total_quantity !== 1) { showError("Para produtos rastreáveis, a Quantidade Total deve ser 1."); return; }

    setIsSaving(true);
    try {
      const productPayload = { name: newProduct.name, type: newProduct.type, total_quantity: newProduct.total_quantity, price: newProduct.price, active: true };
      const { data: productData, error: productError } = await supabase.from('products').insert([productPayload]).select('id').single();
      if (productError) throw productError;
      
      if (newProduct.type === 'trackable' && newProduct.serial_number.trim()) {
        await supabase.from('assets').insert({ product_id: productData.id, serial_number: newProduct.serial_number.trim() });
      }

      showSuccess("Produto criado!");
      setIsAddModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['allProducts'] });
      setNewProduct({ name: '', type: 'trackable', total_quantity: 1, price: 0, serial_number: '' });
    } catch (error: any) { showError("Erro: " + error.message); } finally { setIsSaving(false); }
  };

  const handleEditProduct = (productId: string) => { setSelectedProductId(productId); setIsEditSheetOpen(true); };
  const filteredProducts = rawProducts?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const isLoading = loadingProducts || loadingOrders;
  const isTrackable = newProduct.type === 'trackable';

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-2xl md:text-3xl font-heading font-extrabold tracking-tight">Inventário</h1><p className="text-muted-foreground">Disponibilidade baseada em saídas físicas confirmadas.</p></div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 w-full md:w-auto"><Plus className="mr-2 h-4 w-4" /> Novo Produto</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Novo Produto</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} placeholder="Ex: Câmera Sony" /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Tipo</Label><Select value={newProduct.type} onValueChange={(val: any) => setNewProduct({...newProduct, type: val, total_quantity: val === 'trackable' ? 1 : newProduct.total_quantity})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trackable">Rastreável</SelectItem><SelectItem value="bulk">Granel</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Qtd Total</Label><Input type="number" min={isTrackable ? "1" : "0"} value={newProduct.total_quantity} onChange={(e) => setNewProduct({...newProduct, total_quantity: parseInt(e.target.value) || 1})} disabled={isTrackable} /></div>
              </div>
              {isTrackable && (<div className="space-y-2"><Label>Serial Inicial</Label><Input value={newProduct.serial_number} onChange={(e) => setNewProduct({...newProduct, serial_number: e.target.value})} placeholder="SN-001" required /></div>)}
              <div className="space-y-2"><Label>Preço Diária (R$)</Label><Input type="number" step="0.01" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button><Button onClick={handleCreateProduct} disabled={isSaving} className="bg-primary hover:bg-primary/90">{isSaving ? <Loader2 className="animate-spin" /> : 'Salvar'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Buscar..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
      </div>

      {!isMobile && (
        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center text-secondary">Na Rua (Status)</TableHead>
                  <TableHead className="text-center text-green-600">Disponível Real</TableHead>
                  <TableHead>Diária</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> : 
                 filteredProducts?.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center h-24">Nenhum produto.</TableCell></TableRow> :
                 filteredProducts?.map((product) => {
                   const { available, rented } = calculateStock(product.id, product.total_quantity || 0);
                   const status = getAvailabilityStatus(available, product.total_quantity || 0);
                   return (
                     <TableRow key={product.id}>
                       <TableCell className="font-medium">{product.name}</TableCell>
                       <TableCell><Badge variant={product.type === 'trackable' ? 'secondary' : 'default'}>{product.type === 'trackable' ? 'Rastreável' : 'Granel'}</Badge></TableCell>
                       <TableCell className="text-center text-gray-500">{product.total_quantity}</TableCell>
                       <TableCell className="text-center font-bold text-secondary bg-secondary/10 rounded">{rented}</TableCell>
                       <TableCell className="text-center"><div className="flex items-center justify-center gap-1"><span className={cn("font-bold", status.color)}>{available}</span>{status.badge}</div></TableCell>
                       <TableCell>R$ {Number(product.price).toFixed(2)}</TableCell>
                       <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => handleEditProduct(product.id)}><Edit className="h-4 w-4 mr-1" /> Editar</Button></TableCell>
                     </TableRow>
                   );
                 })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      {isMobile && (
        <div className="space-y-4">
          {isLoading ? <div className="text-center"><Loader2 className="animate-spin mx-auto" /></div> : 
           filteredProducts?.map((product) => <ProductCardMobile key={product.id} product={product} available={calculateStock(product.id, product.total_quantity || 0).available} handleEditProduct={handleEditProduct} />)}
        </div>
      )}
      <EditProductSheet productId={selectedProductId} open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen} />
    </div>
  );
};

export default Inventory;
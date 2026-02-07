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
import { fetchInventoryAnalytics } from '@/integrations/supabase/queries';
import { cn } from '@/lib/utils';
import EditProductSheet from '@/components/inventory/EditProductSheet';
import { useIsMobile } from '@/hooks/use-mobile';

// Tipagem básica para os dados da view
interface InventoryItem {
  id: string;
  name: string;
  type: 'trackable' | 'bulk';
  price: number;
  total_quantity: number;
  active_rentals: number;
  available_quantity: number;
}

const getAvailabilityStatus = (item: InventoryItem) => {
  const available = item.available_quantity;
  const total = item.total_quantity;
  const percentage = total > 0 ? (available / total) : 0;

  if (available <= 0) {
    return { 
      color: 'text-red-600 font-bold', 
      badge: <Badge variant="destructive" className="ml-2 bg-red-100 text-red-800">Esgotado</Badge>,
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />
    };
  }
  if (percentage <= 0.2) { // 20% ou menos
    return { 
      color: 'text-orange-600 font-bold', 
      badge: <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800">Baixo Estoque</Badge>,
      icon: <AlertTriangle className="h-4 w-4 text-orange-500" />
    };
  }
  return { 
    color: 'text-green-600 font-bold', 
    badge: null,
    icon: <CheckCircle className="h-4 w-4 text-green-500" />
  };
};

// Novo componente para o Card Mobile
const ProductCardMobile = ({ product, handleEditProduct }: { product: InventoryItem, handleEditProduct: (id: string) => void }) => {
  const status = getAvailabilityStatus(product);
  
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="font-bold text-lg">{product.name}</h3>
            <Badge variant={product.type === 'trackable' ? 'default' : 'secondary'} className="capitalize text-xs">
              {product.type === 'trackable' ? 'Rastreável' : 'Granel'}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product.id)}>
          <Edit className="h-4 w-4 text-gray-500" />
        </Button>
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-center border-t pt-3">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold">{product.total_quantity}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Alugados</p>
          <p className="font-semibold text-blue-600">{product.active_rentals}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Diária</p>
          <p className="font-semibold">R$ {Number(product.price).toFixed(2)}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-sm font-semibold text-gray-700">Disponível Hoje:</p>
        <div className="flex items-center gap-2">
          <span className={cn("text-lg", status.color)}>
            {product.available_quantity}
          </span>
          {status.icon}
        </div>
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
  
  const [newProduct, setNewProduct] = useState({
    name: '',
    type: 'trackable',
    total_quantity: 1,
    price: 0,
    serial_number: '', // Novo campo para o serial
  });

  const { data: products, isLoading, isError } = useQuery<InventoryItem[]>({
    queryKey: ['inventoryAnalytics'],
    queryFn: fetchInventoryAnalytics,
  });

  const handleCreateProduct = async () => {
    if (newProduct.type === 'trackable' && !newProduct.serial_number.trim()) {
      showError("Produtos rastreáveis requerem um Número de Série inicial.");
      return;
    }
    
    if (newProduct.type === 'trackable' && newProduct.total_quantity !== 1) {
        showError("Para produtos rastreáveis, a Quantidade Total deve ser 1 ao cadastrar o primeiro item. Use a aba 'Ativos' para adicionar mais seriais.");
        return;
    }

    setIsSaving(true);
    try {
      // 1. Captura do Usuário Atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Passo A: Insira o produto na tabela 'products'
      const productPayload = {
        name: newProduct.name,
        type: newProduct.type,
        total_quantity: newProduct.total_quantity,
        price: newProduct.price,
        user_id: user.id, // INCLUSÃO OBRIGATÓRIA
      };
      
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert([productPayload])
        .select('id')
        .single();

      if (productError) throw productError;
      
      const createdProductId = productData.id;

      // Passo C: SE for rastreável, insira o ativo na tabela 'assets'
      if (newProduct.type === 'trackable' && newProduct.serial_number.trim()) {
        const { error: assetError } = await supabase
          .from('assets')
          .insert({
            product_id: createdProductId,
            serial_number: newProduct.serial_number.trim(),
            user_id: user.id, // INCLUSÃO OBRIGATÓRIA
          });
          
        if (assetError) throw assetError;
      }

      showSuccess("Produto e Ativo inicial criados com sucesso!");
      setIsAddModalOpen(false);
      
      // Invalida a query da view para forçar a atualização dos dados
      queryClient.invalidateQueries({ queryKey: ['inventoryAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['allProducts'] }); // Atualiza lista de produtos para pedidos
      
      setNewProduct({ name: '', type: 'trackable', total_quantity: 1, price: 0, serial_number: '' });
    } catch (error: any) {
      showError("Erro ao criar produto: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditProduct = (productId: string) => {
    setSelectedProductId(productId);
    setIsEditSheetOpen(true);
  };

  if (isError) {
    return <div className="p-8 text-center text-red-500">Erro ao carregar dados do inventário.</div>;
  }
  
  const isTrackable = newProduct.type === 'trackable';

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Ajuste de Cabeçalho: flex-col no mobile, flex-row no desktop */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Inventário</h1>
          <p className="text-muted-foreground">Gerencie seus ativos e estoque aqui.</p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Produto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto</Label>
                <Input 
                  id="name" 
                  value={newProduct.name} 
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  placeholder="Ex: Câmera Sony A7III" 
                />
              </div>
              {/* Ajuste de Grid: grid-cols-1 no mobile, grid-cols-2 no desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={newProduct.type} 
                    onValueChange={(val) => {
                        const type = val as 'trackable' | 'bulk';
                        setNewProduct(prev => ({
                            ...prev, 
                            type: type,
                            // Se mudar para rastreável, força quantidade para 1
                            total_quantity: type === 'trackable' ? 1 : prev.total_quantity
                        }));
                    }}
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
                  <Label htmlFor="quantity">Quantidade Total</Label>
                  <Input 
                    id="quantity" 
                    type="number"
                    min={isTrackable ? "1" : "0"} // Mínimo 1 se for rastreável
                    value={newProduct.total_quantity} 
                    onChange={(e) => setNewProduct({...newProduct, total_quantity: parseInt(e.target.value) || 1})}
                    disabled={isTrackable} // Desabilita se for rastreável (força 1)
                  />
                </div>
              </div>
              
              {/* Campo de Número de Série Condicional */}
              {isTrackable && (
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Número de Série / Patrimônio</Label>
                  <Input 
                    id="serial_number" 
                    value={newProduct.serial_number} 
                    onChange={(e) => setNewProduct({...newProduct, serial_number: e.target.value})}
                    placeholder="Ex: SN-A7III-001"
                    required
                  />
                  {newProduct.total_quantity > 1 && (
                    <p className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        Para itens rastreáveis, a quantidade é forçada para 1. Adicione mais seriais na tela de edição.
                    </p>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="price">Preço da Diária (R$)</Label>
                <Input 
                  id="price" 
                  type="number"
                  step="0.01"
                  value={newProduct.price} 
                  onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleCreateProduct} className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Salvar Produto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar produtos..." className="pl-10" />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Visualização Desktop (Tabela) */}
      {!isMobile && (
        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto"> {/* Garantido overflow-x-auto */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Estoque Total</TableHead>
                  <TableHead className="text-center">Alugados Agora</TableHead>
                  <TableHead className="text-center">Disponível Hoje</TableHead>
                  <TableHead>Preço (Diária)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                    </TableCell>
                  </TableRow>
                ) : products?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhum produto cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  products?.map((product) => {
                    const status = getAvailabilityStatus(product);
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge variant={product.type === 'trackable' ? 'default' : 'secondary'} className="capitalize">
                            {product.type === 'trackable' ? 'Rastreável' : 'Granel'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-gray-500">{product.total_quantity}</TableCell>
                        <TableCell className="text-center text-blue-600 font-medium">{product.active_rentals}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <span className={cn("font-bold", status.color)}>
                              {product.available_quantity}
                            </span>
                            {status.badge}
                          </div>
                        </TableCell>
                        <TableCell>R$ {Number(product.price).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product.id)}>
                            <Edit className="h-4 w-4 mr-1" /> Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      {/* Visualização Mobile (Cards) */}
      {isMobile && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="h-24 text-center flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
            </div>
          ) : products?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-xl">
              Nenhum produto cadastrado.
            </p>
          ) : (
            products?.map((product) => (
              <ProductCardMobile 
                key={product.id} 
                product={product} 
                handleEditProduct={handleEditProduct} 
              />
            ))
          )}
        </div>
      )}

      <EditProductSheet
        productId={selectedProductId}
        open={isEditSheetOpen}
        onOpenChange={setIsEditSheetOpen}
      />
    </div>
  );
};

export default Inventory;
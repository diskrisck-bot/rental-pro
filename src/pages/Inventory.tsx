"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
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

const Inventory = () => {
  // Mock data para demonstração inicial
  const products = [
    { id: '1', name: 'Câmera Sony A7III', type: 'trackable', quantity: 2, price: 250 },
    { id: '2', name: 'Cabo HDMI 5m', type: 'bulk', quantity: 50, price: 15 },
    { id: '3', name: 'Tripé Manfrotto', type: 'trackable', quantity: 5, price: 80 },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventário</h1>
          <p className="text-muted-foreground">Gerencie seus ativos e estoque aqui.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
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

      <div className="border rounded-xl bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estoque Total</TableHead>
              <TableHead>Preço (Diária)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant={product.type === 'trackable' ? 'default' : 'secondary'} className="capitalize">
                    {product.type === 'trackable' ? 'Rastreável' : 'Granel'}
                  </Badge>
                </TableCell>
                <TableCell>{product.quantity}</TableCell>
                <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">Editar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Inventory;
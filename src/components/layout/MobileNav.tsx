"use client";

import React, { useState } from 'react';
import { Menu, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Sidebar from './Sidebar';

const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 bg-white border-b p-4 flex justify-between items-center md:hidden shadow-sm">
      <div className="flex items-center gap-2">
        <Package className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-blue-600">RentalPro</h1>
      </div>
      
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 sm:w-72">
          {/* Passa a função para fechar o sheet para a Sidebar */}
          <Sidebar onLinkClick={() => setIsOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileNav;
"use client";

import React, { useState } from 'react';
import { Menu, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Sidebar from './Sidebar';

const MobileMenuTrigger = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0 w-64 sm:w-72">
        {/* Passa a função para fechar o sheet para a Sidebar */}
        <Sidebar onLinkClick={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenuTrigger;
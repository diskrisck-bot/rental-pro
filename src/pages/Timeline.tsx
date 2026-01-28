"use client";

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addDays, startOfToday, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Timeline = () => {
  const today = startOfToday();
  const days = eachDayOfInterval({
    start: today,
    end: addDays(today, 14),
  });

  const resources = [
    { id: '1', name: 'Câmera Sony #01', type: 'trackable' },
    { id: '2', name: 'Câmera Sony #02', type: 'trackable' },
    { id: '3', name: 'Cabo HDMI (Bulk)', type: 'bulk' },
    { id: '4', name: 'Tripé #01', type: 'trackable' },
  ];

  return (
    <div className="p-8 space-y-6 h-screen flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
          <p className="text-muted-foreground">Disponibilidade e agendamentos em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
          <Button variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-4 font-medium">Maio 2024</span>
          <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex-1 bg-white border rounded-xl overflow-auto relative">
        <div className="inline-block min-w-full">
          {/* Header das Datas */}
          <div className="flex sticky top-0 z-20 bg-gray-50 border-b">
            <div className="w-64 p-4 border-r font-semibold text-gray-500 bg-gray-50 sticky left-0 z-30">Ativos</div>
            {days.map((day) => (
              <div key={day.toString()} className="flex-1 min-w-[120px] p-4 text-center border-r last:border-r-0">
                <div className="text-xs uppercase text-gray-400 font-bold">{format(day, 'EEE', { locale: ptBR })}</div>
                <div className="text-lg font-semibold">{format(day, 'dd')}</div>
              </div>
            ))}
          </div>

          {/* Linhas da Timeline */}
          {resources.map((resource) => (
            <div key={resource.id} className="flex border-b last:border-b-0 hover:bg-gray-50 transition-colors group">
              <div className="w-64 p-4 border-r font-medium text-gray-700 bg-white sticky left-0 z-10 group-hover:bg-gray-50">
                {resource.name}
                {resource.type === 'bulk' && <span className="block text-xs text-blue-500 font-normal">Capacidade: 50</span>}
              </div>
              <div className="flex flex-1 relative h-16">
                {days.map((day) => (
                  <div key={day.toString()} className="flex-1 min-w-[120px] border-r last:border-r-0 bg-grid-pattern opacity-10" />
                ))}
                
                {/* Exemplo de Bloco de Agendamento (Mock) */}
                {resource.id === '1' && (
                  <div className="absolute top-2 left-[240px] w-[360px] h-12 bg-yellow-400/90 rounded-md border border-yellow-500 shadow-sm flex items-center px-3 text-xs font-bold text-yellow-900 overflow-hidden whitespace-nowrap z-10">
                    RESERVADO: João Silva
                  </div>
                )}
                {resource.id === '2' && (
                  <div className="absolute top-2 left-[0px] w-[240px] h-12 bg-blue-500/90 rounded-md border border-blue-600 shadow-sm flex items-center px-3 text-xs font-bold text-white overflow-hidden whitespace-nowrap z-10">
                    RETIRADO: Maria Oliveira
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
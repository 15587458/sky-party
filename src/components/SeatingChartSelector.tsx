import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { ChartElement, Event } from '../types';
import SeatingChartCanvas from './SeatingChartCanvas';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Ticket, User, Info, ZoomIn, ZoomOut, Maximize, Plus, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

interface SeatingChartSelectorProps {
  event: Event;
  ticketType: 'standard' | 'vip';
  onSelect: (element: ChartElement, quantity: number) => void;
  onClose: () => void;
}

export default function SeatingChartSelector({ event, ticketType, onSelect, onClose }: SeatingChartSelectorProps) {
  const { charts, orders, loadChartElements } = useApp();
  const [selectedElement, setSelectedElement] = useState<ChartElement | null>(null);
  const [elements, setElements] = useState<ChartElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [quantity, setQuantity] = useState(1);
  
  const chart = charts.find(c => c.id === event.chartId);
  
  // Scroll Lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (chart?.id) {
      loadChartElements(chart.id).then(data => {
        setElements(data);
        setLoading(false);
      });
    }
  }, [chart?.id, loadChartElements]);

  if (!chart) return null;
  if (loading) {
    return (
      <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
           <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Завантаження схеми...</p>
        </div>
      </div>
    );
  }

  // Simple occupied check
  const occupiedIds = orders
    .filter(o => o.eventId === event.id && (o.status === 'paid' || o.status === 'pending') && o.elementId)
    .map(o => o.elementId!);

  const handleSeatClick = (id: string) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const isOccupied = (el.type === 'seat' || (el.type === 'table' && el.sellAsWhole)) && occupiedIds.includes(el.id);
    if (isOccupied || el.isBlocked) return;
    
    if (selectedElement?.id === el.id) {
      if (el.type === 'fanzone' || (el.type === 'table' && el.sellAsWhole)) {
        setQuantity(prev => prev + 1);
      }
      return;
    } else {
      setSelectedElement(el);
      setQuantity(1);
    }
  };

  const getPrice = (el: ChartElement) => {
    let basePrice = el.priceType === 'vip' ? Number(event.vipPrice || 0) : Number(event.price || 0);
    if (el.type === 'table' && el.sellAsWhole && el.seatsCount) {
      return basePrice * el.seatsCount * quantity;
    }
    return basePrice * quantity;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/95 flex flex-col"
    >
      {/* Header */}
      <div className="h-16 lg:h-20 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between px-4 lg:px-8 shrink-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <button 
            onClick={onClose}
            className="p-2 lg:p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"
          >
            <X size={20} />
          </button>
          <div>
             <h2 className="text-sm lg:text-xl font-black uppercase tracking-tight text-white line-clamp-1">{event.title}</h2>
             <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-zinc-500">
               Оберіть місце на схемі залу
             </p>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            <span className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-zinc-400">Вільні</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-zinc-800" />
            <span className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-zinc-400">Зайнято</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Canvas Area */}
        <div className="h-[45vh] lg:h-auto lg:flex-1 bg-[#050505] relative overflow-hidden flex items-center justify-center p-4 lg:p-12 shrink-0 lg:shrink">
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[25vw] font-black text-white/[0.01] select-none tracking-tighter">
            STAGE
          </div>
          
          {/* Zoom Controls */}
          <div className="absolute bottom-6 left-6 lg:bottom-12 lg:left-12 flex flex-col gap-3 z-[160]">
            <button 
              onClick={() => setScale(prev => Math.min(prev * 1.2, 5))}
              className="w-12 h-12 lg:w-14 lg:h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-white/50 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl"
              title="Наблизити"
            >
              <ZoomIn size={24} />
            </button>
            <button 
              onClick={() => setScale(prev => Math.max(prev / 1.2, 0.2))}
              className="w-12 h-12 lg:w-14 lg:h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-white/50 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl"
              title="Віддалити"
            >
              <ZoomOut size={24} />
            </button>
            <button 
              onClick={() => setScale(1)}
              className="w-12 h-12 lg:w-14 lg:h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-white/50 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl"
              title="Скинути"
            >
              <Maximize size={24} />
            </button>
          </div>
          
          <div className="w-full max-w-[min(90vw,1000px)] aspect-square bg-[#0a0a0a] rounded-[20px] lg:rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden p-4 lg:p-8">
            <SeatingChartCanvas 
              elements={elements}
              backgroundImage={chart.backgroundImage}
              occupiedIds={occupiedIds}
              selectedId={selectedElement?.id || null}
              onSelect={handleSeatClick}
              width={1000}
              height={800}
              scale={scale}
              onScaleChange={setScale}
            />
          </div>
        </div>

        {/* Info Panel */}
        <div className="flex-1 lg:w-96 border-t lg:border-t-0 lg:border-l border-white/5 bg-zinc-900/30 p-6 lg:p-10 flex flex-col gap-6 lg:gap-10 overflow-y-auto">
          <div className="space-y-4 lg:space-y-6">
            <h3 className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-zinc-600">Деталі вибору</h3>
            
            <AnimatePresence mode="wait">
              {selectedElement ? (
                <motion.div 
                  key="selected"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-neon-purple/10 flex items-center justify-center text-neon-purple border border-neon-purple/20">
                         {selectedElement.type === 'seat' ? <User size={32} /> : <Ticket size={32} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{selectedElement.type === 'seat' ? 'Місце' : 'Елемент'}</p>
                        <h4 className="text-2xl font-black text-white">{selectedElement.label || 'Без назви'}</h4>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center py-4 border-t border-white/5">
                      <span className="text-xs font-bold text-zinc-400">Кількість:</span>
                      <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/5">
                         <button 
                           onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                           className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                         >
                           <Minus size={14} />
                         </button>
                         <span className="text-sm font-black w-4 text-center">{quantity}</span>
                         <button 
                           onClick={() => setQuantity(prev => prev + 1)}
                           className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-neon-purple transition-colors"
                         >
                           <Plus size={14} />
                         </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-4 border-t border-white/5">
                      <span className="text-xs font-bold text-zinc-400">Разом:</span>
                      <span className="text-xl font-black text-white">
                        {getPrice(selectedElement)} грн
                      </span>
                    </div>

                    {selectedElement.type === 'table' && selectedElement.sellAsWhole && (
                      <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20 flex items-center gap-3">
                        <Info size={16} className="text-purple-500 shrink-0" />
                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-tight">Стіл на {selectedElement.seatsCount} осіб продається повністю</p>
                      </div>
                    )}

                    {selectedElement.type === 'fanzone' && (
                      <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center gap-3">
                        <Info size={16} className="text-blue-500 shrink-0" />
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">Це вхідний квиток у Фан-зону без нумерованого місця</p>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => (onSelect as any)(selectedElement, quantity)}
                    className="w-full h-20 bg-white text-black rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neon-purple hover:text-white transition-all shadow-xl group active:scale-95 transition-all"
                  >
                    <span>Оформити {quantity > 1 ? `${quantity} квитків` : 'квиток'}</span>
                    <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-6 opacity-30"
                >
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center">
                    <Layout size={32} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Оберіть вільне місце на схемі залу</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto space-y-4">
             <div className="flex items-center gap-3 p-4 bg-white/[0.02] rounded-2xl">
               <div className="w-1 h-1 rounded-full bg-zinc-600" />
               <p className="text-[9px] uppercase font-bold text-zinc-500">Квитки поверненню не підлягають</p>
             </div>
             <div className="flex items-center gap-3 p-4 bg-white/[0.02] rounded-2xl">
               <div className="w-1 h-1 rounded-full bg-zinc-600" />
               <p className="text-[9px] uppercase font-bold text-zinc-500">18+ | Обов'язкова наявність документів</p>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Layout({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

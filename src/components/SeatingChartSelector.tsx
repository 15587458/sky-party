import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { ChartElement, Event } from '../types';
import SeatingChartCanvas from './SeatingChartCanvas';
import Zosyna3DHall from './Zosyna3DHall';
import { ZOSYNA_CHART_ID } from '../data/zosynaPreset';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronDown,
  Ticket, 
  User, 
  Info, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Plus, 
  Minus, 
  Box, 
  Layers, 
  Crown,
  Sparkles,
  CheckCircle2,
  ShoppingCart,
  Trash2
} from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  
  const chart = charts.find(c => c.id === event.chartId) || charts.find(c => c.id === ZOSYNA_CHART_ID || c.name?.toLowerCase().includes('зосина'));
  
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
    } else {
      loadChartElements(ZOSYNA_CHART_ID).then(data => {
        setElements(data);
        setLoading(false);
      });
    }
  }, [chart?.id, loadChartElements]);

  if (!chart && loading) {
    return (
      <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
           <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Завантаження схеми залу...</p>
        </div>
      </div>
    );
  }

  // Occupied check
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
    } else {
      setSelectedElement(el);
      setQuantity(1);
    }
    setMobileCartOpen(true);
  };

  const handle3DSelect = (el: ChartElement, qty: number = 1) => {
    const isOccupied = (el.type === 'seat' || (el.type === 'table' && el.sellAsWhole)) && occupiedIds.includes(el.id);
    if (isOccupied || el.isBlocked) return;

    if (selectedElement?.id === el.id) {
      if (el.type === 'fanzone' || (el.type === 'table' && el.sellAsWhole)) {
        setQuantity(prev => prev + 1);
      }
    } else {
      setSelectedElement(el);
      setQuantity(qty || 1);
    }
    setMobileCartOpen(true);
  };

  const getSingleTicketPrice = (el: ChartElement) => {
    const isVip = el.priceType === 'vip' || el.type === 'table';
    return isVip ? Number(event.vipPrice || event.price || 0) : Number(event.price || 0);
  };

  const getTotalPrice = (el: ChartElement) => {
    const isVip = el.priceType === 'vip' || el.type === 'table';
    const basePrice = isVip ? Number(event.vipPrice || event.price || 0) : Number(event.price || 0);
    if (el.type === 'table' && el.sellAsWhole && el.seatsCount) {
      return basePrice * el.seatsCount * quantity;
    }
    return basePrice * quantity;
  };

  const handleCheckout = () => {
    if (!selectedElement) return;
    onSelect(selectedElement, quantity);
  };

  const isFanzone = selectedElement?.type === 'fanzone';
  const isTable = selectedElement?.type === 'table';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black flex flex-col font-sans overflow-hidden"
    >
      {/* Top Floating / Header Bar */}
      <div className="h-14 sm:h-16 lg:h-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl flex items-center justify-between px-3 sm:px-6 lg:px-8 shrink-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <button 
            onClick={onClose}
            className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/15 rounded-full transition-all text-white/70 hover:text-white shrink-0 active:scale-95"
            title="Закрити"
          >
            <X size={18} />
          </button>
          <div className="min-w-0">
             <h2 className="text-xs sm:text-base lg:text-xl font-black uppercase tracking-tight text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">{event.title}</h2>
             <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-400 truncate">
               Схема залу Зосина
             </p>
          </div>
        </div>

        {/* Center / Right Controls & Mode Switcher */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* 3D / 2D Switcher */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-2xl border border-white/10 shadow-lg">
            <button
              onClick={() => setViewMode('3d')}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95",
                viewMode === '3d' 
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" 
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Box size={14} />
              <span>3D</span>
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95",
                viewMode === '2d' 
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" 
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Layers size={14} />
              <span>2D</span>
            </button>
          </div>

          {/* Color Legend (Desktop Only) */}
          <div className="hidden lg:flex items-center gap-4 bg-zinc-900/60 px-3 py-1.5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Фан-зона</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Столи VIP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Зайнято</span>
            </div>
          </div>

          {/* Mobile Cart Toggle Button */}
          <button
            onClick={() => setMobileCartOpen(prev => !prev)}
            className={cn(
              "lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border transition-all active:scale-95 font-black text-xs uppercase tracking-wider shadow-xl",
              selectedElement 
                ? "bg-purple-600 text-white border-purple-400 shadow-purple-600/30" 
                : "bg-zinc-900/90 text-zinc-400 border-white/10 hover:text-white"
            )}
          >
            <ShoppingCart size={15} />
            <span>Корзина</span>
            {selectedElement && (
              <span className="w-4 h-4 rounded-full bg-white text-purple-700 text-[10px] font-black flex items-center justify-center">
                {quantity}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Container: Full Screen Map on Mobile + Split Layout on Desktop */}
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Full-Screen Visualizer Stage */}
        <div className="absolute inset-0 lg:static lg:flex-1 w-full h-full bg-[#07080c] relative overflow-hidden flex items-center justify-center p-0 lg:p-6">
          {viewMode === '3d' ? (
            <div className="w-full h-full lg:rounded-[36px] overflow-hidden lg:border lg:border-white/10 lg:shadow-2xl relative">
              <Zosyna3DHall 
                elements={elements}
                occupiedIds={occupiedIds}
                selectedId={selectedElement?.id || null}
                onSelect={handle3DSelect}
                event={event}
                ticketType={ticketType}
                className="w-full h-full"
              />
            </div>
          ) : (
            <div className="w-full h-full relative flex items-center justify-center p-2 sm:p-4">
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[25vw] font-black text-white/[0.01] select-none tracking-tighter">
                STAGE
              </div>
              
              {/* Zoom Controls for 2D */}
              <div className="absolute bottom-4 left-4 lg:bottom-10 lg:left-10 flex flex-col gap-2 z-[160]">
                <button 
                  onClick={() => setScale(prev => Math.min(prev * 1.2, 5))}
                  className="w-10 h-10 lg:w-12 lg:h-12 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-white/70 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl active:scale-95"
                  title="Наблизити"
                >
                  <ZoomIn size={18} />
                </button>
                <button 
                  onClick={() => setScale(prev => Math.max(prev / 1.2, 0.2))}
                  className="w-10 h-10 lg:w-12 lg:h-12 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-white/70 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl active:scale-95"
                  title="Віддалити"
                >
                  <ZoomOut size={18} />
                </button>
                <button 
                  onClick={() => setScale(1)}
                  className="w-10 h-10 lg:w-12 lg:h-12 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-white/70 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl active:scale-95"
                  title="Скинути"
                >
                  <Maximize size={18} />
                </button>
              </div>
              
              <div className="w-full max-w-[min(92vw,1000px)] aspect-square bg-[#0a0a0a] rounded-[20px] lg:rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden p-2 sm:p-4 lg:p-8">
                <SeatingChartCanvas 
                  elements={elements}
                  backgroundImage={chart?.backgroundImage}
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
          )}
        </div>

        {/* Mobile Floating Cart Trigger Pill (when element is selected but sheet is closed) */}
        {selectedElement && !mobileCartOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="lg:hidden absolute bottom-4 left-4 right-4 z-40"
          >
            <div className="bg-zinc-950/95 backdrop-blur-xl border border-purple-500/40 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                  isTable ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                )}>
                  {isTable ? <Crown size={18} /> : <Sparkles size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate">{selectedElement.label}</p>
                  <p className="text-[10px] text-zinc-400 font-bold">
                    {isFanzone ? `1 квиток: ${getSingleTicketPrice(selectedElement)} грн` : `Стіл: ${getTotalPrice(selectedElement)} грн`}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setMobileCartOpen(true)}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-purple-600/30 shrink-0 active:scale-95"
              >
                <span>Оформити</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Mobile Floating Cart / Checkout Bottom Drawer */}
        <AnimatePresence>
          {mobileCartOpen && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="lg:hidden absolute inset-x-0 bottom-0 z-50 bg-zinc-950/95 backdrop-blur-2xl border-t border-white/10 rounded-t-[32px] p-5 shadow-2xl max-h-[85vh] flex flex-col space-y-4"
            >
              {/* Drawer Top Handle */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-300">Корзина квитків</span>
                </div>
                <div className="flex items-center gap-1">
                  {selectedElement && (
                    <button
                      onClick={() => {
                        setSelectedElement(null);
                        setMobileCartOpen(false);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 mr-1"
                    >
                      <Trash2 size={13} />
                      <span>Очистити</span>
                    </button>
                  )}
                  <button
                    onClick={() => setMobileCartOpen(false)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-zinc-300 active:scale-95"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
              </div>

              {selectedElement ? (
                <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0",
                        isTable ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                      )}>
                        {isTable ? <Crown size={24} /> : <Ticket size={24} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                            {isTable ? 'Стіл (VIP)' : 'Фан-зона (Standard)'}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-white truncate">{selectedElement.label || 'Без назви'}</h4>
                        {isFanzone && (
                          <p className="text-[11px] font-black text-purple-300">
                            Ціна за 1 квиток: <span className="text-white font-mono">{getSingleTicketPrice(selectedElement)} грн</span>
                          </p>
                        )}
                        {isTable && (
                          <p className="text-[11px] font-black text-yellow-300">
                            Стіл на {selectedElement.seatsCount || 6} місць
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex justify-between items-center py-2 border-t border-white/5">
                      <span className="text-xs font-bold text-zinc-300">
                        {isTable ? 'Кількість столів:' : 'Кількість квитків:'}
                      </span>
                      <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/10">
                        <button 
                          onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white active:scale-95"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-black w-6 text-center text-white font-mono">{quantity}</span>
                        <button 
                          onClick={() => setQuantity(prev => prev + 1)}
                          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-purple-400 active:scale-95"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Total Price */}
                    <div className="flex justify-between items-center py-2.5 border-t border-white/5">
                      <span className="text-xs font-bold text-zinc-300">Разом до сплати:</span>
                      <span className="text-xl font-black text-green-400 font-mono">
                        {getTotalPrice(selectedElement)} грн
                      </span>
                    </div>

                    {isFanzone && (
                      <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 flex items-center gap-2">
                        <Info size={13} className="text-purple-400 shrink-0" />
                        <p className="text-[10px] font-bold text-purple-300">Вхідний квиток у Фан-зону біля сцени</p>
                      </div>
                    )}
                  </div>

                  {/* Checkout Button */}
                  <button 
                    onClick={handleCheckout}
                    className="w-full h-14 bg-white hover:bg-purple-600 text-black hover:text-white rounded-2xl font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95"
                  >
                    <span>Оформити квиток • {getTotalPrice(selectedElement)} грн</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500">
                    <ShoppingCart size={22} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 max-w-[220px]">
                    Торкніться столу або фан-зони на карті для вибору
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar Panel */}
        <div className="hidden lg:flex w-96 border-l border-white/10 bg-zinc-950/95 p-6 lg:p-8 flex-col justify-between overflow-y-auto shrink-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <ShoppingCart size={14} className="text-purple-400" />
                <span>Ваш вибір</span>
              </h3>
              {selectedElement && (
                <button 
                  onClick={() => setSelectedElement(null)}
                  className="text-[10px] text-zinc-400 hover:text-white uppercase font-bold transition-colors"
                >
                  Скинути
                </button>
              )}
            </div>
            
            <AnimatePresence mode="wait">
              {selectedElement ? (
                <motion.div 
                  key="selected"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="p-5 bg-white/5 rounded-3xl border border-white/10 space-y-3.5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0",
                        isTable ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                      )}>
                         {isTable ? <Crown size={26} /> : <Sparkles size={26} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                          {isTable ? 'Стіл (VIP)' : 'Фан-зона (Standard)'}
                        </p>
                        <h4 className="text-xl font-black text-white truncate">{selectedElement.label || 'Без назви'}</h4>
                        {isTable ? (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[9px] font-black uppercase tracking-widest">
                            <Crown size={10} />
                            VIP Стіл
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-black uppercase tracking-widest">
                            <Sparkles size={10} />
                            Фан-зона
                          </span>
                        )}
                      </div>
                    </div>

                    {isFanzone && (
                      <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-300">Ціна за 1 квиток:</span>
                        <span className="text-base font-black text-purple-200 font-mono">{getSingleTicketPrice(selectedElement)} грн</span>
                      </div>
                    )}
                    
                    {/* Quantity Stepper */}
                    <div className="flex justify-between items-center py-2.5 border-t border-white/5">
                      <span className="text-xs font-bold text-zinc-300">
                        {isTable ? 'Кількість столів:' : 'Кількість квитків:'}
                      </span>
                      <div className="flex items-center gap-2.5 bg-white/5 p-1 rounded-xl border border-white/10">
                         <button 
                           onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                           className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white active:scale-95"
                         >
                           <Minus size={14} />
                         </button>
                         <span className="text-sm font-black w-6 text-center text-white font-mono">{quantity}</span>
                         <button 
                           onClick={() => setQuantity(prev => prev + 1)}
                           className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-purple-400 transition-colors active:scale-95"
                         >
                           <Plus size={14} />
                         </button>
                      </div>
                    </div>

                    {/* Total Price */}
                    <div className="flex justify-between items-center py-2.5 border-t border-white/5">
                      <span className="text-xs font-bold text-zinc-300">Разом до сплати:</span>
                      <span className="text-xl font-black text-green-400 font-mono">
                        {getTotalPrice(selectedElement)} грн
                      </span>
                    </div>

                    {isTable && selectedElement.sellAsWhole && (
                      <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 flex items-center gap-2.5">
                        <Info size={14} className="text-yellow-400 shrink-0" />
                        <p className="text-[10px] font-bold text-yellow-300">Стіл на {selectedElement.seatsCount || 6} осіб продається повністю</p>
                      </div>
                    )}

                    {isFanzone && (
                      <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 flex items-center gap-2.5">
                        <Info size={14} className="text-purple-400 shrink-0" />
                        <p className="text-[10px] font-bold text-purple-300">Вхідний квиток у Фан-зону біля сцени без фіксованого місця</p>
                      </div>
                    )}
                  </div>

                  {/* Checkout Button */}
                  <button 
                    onClick={handleCheckout}
                    className="w-full h-14 lg:h-16 bg-white text-black rounded-2xl lg:rounded-3xl font-black uppercase tracking-wider text-xs lg:text-sm flex items-center justify-center gap-2 hover:bg-purple-600 hover:text-white transition-all shadow-xl group active:scale-95"
                  >
                    <span>Оформити {quantity > 1 ? `${quantity} квитків` : 'квиток'} ({getTotalPrice(selectedElement)} грн)</span>
                    <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-10 flex flex-col items-center justify-center text-center p-4 space-y-3 opacity-60"
                >
                  <div className="w-14 h-14 rounded-full border border-dashed border-zinc-700 flex items-center justify-center text-zinc-400">
                    <Box size={24} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 max-w-[240px]">
                    Торкніться столу (жовтий VIP) або фан-зони (фіолетова) у 3D моделі
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto space-y-2 pt-4 border-t border-white/5">
             <div className="flex items-center gap-2 text-zinc-400">
               <CheckCircle2 size={13} className="text-green-400 shrink-0" />
               <p className="text-[9px] uppercase font-bold text-zinc-400">Всі столи — VIP • Фан-зона біля сцени</p>
             </div>
             <div className="flex items-center gap-2 text-zinc-500">
               <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
               <p className="text-[9px] uppercase font-bold">18+ | Обов'язкова наявність документів</p>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import React, { useState } from 'react';
import { Plus, Trash2, Settings, Move, Square, Circle as CircleIcon, Type, Save, Layout } from 'lucide-react';
import SeatingChartCanvas from './SeatingChartCanvas';
import { ChartElement } from '../types';
import { cn } from '../lib/utils';

interface SeatingChartEditorProps {
  initialElements?: ChartElement[];
  initialBackground?: string;
  onSave: (elements: ChartElement[], background?: string) => void;
  onCancel: () => void;
}

export default function SeatingChartEditor({ initialElements = [], initialBackground = '', onSave, onCancel }: SeatingChartEditorProps) {
  const [elements, setElements] = useState<ChartElement[]>(initialElements);
  const [background, setBackground] = useState<string>(initialBackground);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedElement = elements.find(el => el.id === selectedId);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;
      
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const MOVE_STEP = e.shiftKey ? 10 : 2;
      const el = elements.find(item => item.id === selectedId);
      if (!el) return;

      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowUp') dy = -MOVE_STEP;
      else if (e.key === 'ArrowDown') dy = MOVE_STEP;
      else if (e.key === 'ArrowLeft') dx = -MOVE_STEP;
      else if (e.key === 'ArrowRight') dx = MOVE_STEP;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeElement(selectedId);
        return;
      }
      else return;

      e.preventDefault();
      
      setElements(prev => prev.map(item => {
        if (item.id === selectedId) {
          return { ...item, x: item.x + dx, y: item.y + dy };
        }
        return item;
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  const addElement = (type: ChartElement['type'], parentId?: string) => {
    const id = `${type}-${Date.now()}`;
    const newEl: ChartElement = {
      id,
      type,
      x: parentId ? 50 : 100,
      y: parentId ? 50 : 100,
      label: type === 'seat' ? (elements.filter(e => e.type === 'seat').length + 1).toString() : '',
      priceType: 'standard',
      parentId,
    };

    if (type === 'seat') {
      newEl.radius = 15;
    } else if (type === 'table') {
      newEl.width = 60;
      newEl.height = 60;
      newEl.seatsCount = 4;
      newEl.sellAsWhole = true;
    } else if (type === 'fanzone') {
      newEl.width = 200;
      newEl.height = 100;
      newEl.capacity = 50;
    } else if (type === 'text') {
      newEl.label = 'ТЕКСТ';
      newEl.radius = 20; // used as fontSize for simplicity
    }

    setElements([...elements, newEl]);
    setSelectedId(id);
  };

  const updateElement = (id: string, updates: Partial<ChartElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const removeElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id && el.parentId !== id));
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Toolbar */}
      <div className="p-4 border-b border-white/10 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => addElement('seat')}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <CircleIcon size={16} /> Місце
          </button>
          <button 
            onClick={() => addElement('table')}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <Square size={16} /> Стіл
          </button>
          <button 
            onClick={() => addElement('fanzone')}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <Layout size={16} /> Фан-зона
          </button>
          <button 
            onClick={() => addElement('text')}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <Type size={16} /> Текст
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest cursor-pointer border border-white/5">
             <Move size={14} /> ФОН
             <input 
               type="file" 
               accept="image/*" 
               className="hidden" 
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   const reader = new FileReader();
                   reader.onload = (re) => setBackground(re.target?.result as string);
                   reader.readAsDataURL(file);
                 }
               }}
             />
          </label>
          <button 
            onClick={onCancel}
            className="text-zinc-500 hover:text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Скасувати
          </button>
          <button 
            onClick={() => onSave(elements, background)}
            className="bg-white text-black px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-neon-purple hover:text-white transition-all shadow-lg"
          >
            <Save size={16} /> Зберегти схему
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Properties Panel */}
        <div className="w-72 border-r border-white/10 bg-zinc-900/30 p-6 overflow-y-auto space-y-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Властивості</h3>
          
          {selectedElement ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Тип</label>
                <div className="px-4 py-3 bg-zinc-800/50 rounded-2xl border border-white/5 text-sm font-bold text-white capitalize">
                  {selectedElement.type}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Етикетка / Текст</label>
                <input 
                  type="text"
                  value={selectedElement.label || ''}
                  onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                  className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-purple outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Категорія ціни</label>
                <select 
                  value={selectedElement.priceType || 'standard'}
                  onChange={(e) => updateElement(selectedElement.id, { priceType: e.target.value as any })}
                  className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-purple outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="vip">VIP</option>
                </select>
              </div>

              {(selectedElement.type === 'table' || selectedElement.type === 'fanzone') && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Колір зони</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={selectedElement.fill || (selectedElement.priceType === 'vip' ? '#a855f7' : '#71717a')}
                      onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                      className="w-10 h-10 bg-transparent rounded-xl cursor-pointer border border-white/10"
                    />
                    <input 
                      type="text"
                      placeholder="Приклад: #ff0055"
                      value={selectedElement.fill || ''}
                      onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                      className="flex-1 bg-zinc-800 border border-white/5 rounded-2xl px-4 py-2.5 text-xs font-mono focus:ring-2 focus:ring-neon-purple outline-none text-white placeholder-zinc-600"
                    />
                    {selectedElement.fill && (
                      <button 
                        type="button"
                        onClick={() => updateElement(selectedElement.id, { fill: undefined })}
                        className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider px-2 py-1 bg-red-500/10 rounded-lg shrink-0"
                      >
                        Скинути
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {selectedElement.type === 'table' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Розмір столу</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range"
                        min="20"
                        max="300"
                        value={selectedElement.width || 60}
                        onChange={(e) => {
                          const size = parseInt(e.target.value);
                          updateElement(selectedElement.id, { width: size, height: size });
                        }}
                        className="flex-1 accent-neon-purple"
                      />
                      <span className="text-xs font-mono text-zinc-400">{selectedElement.width || 60}</span>
                    </div>
                  </div>
                )}

                {(selectedElement.type === 'fanzone' || selectedElement.type === 'shape') && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Ширина</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range"
                          min="10"
                          max="500"
                          value={selectedElement.width || 60}
                          onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) })}
                          className="flex-1 accent-neon-purple"
                        />
                        <span className="text-xs font-mono text-zinc-400">{selectedElement.width || 60}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Висота</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range"
                          min="10"
                          max="500"
                          value={selectedElement.height || 60}
                          onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) })}
                          className="flex-1 accent-neon-purple"
                        />
                        <span className="text-xs font-mono text-zinc-400">{selectedElement.height || 60}</span>
                      </div>
                    </div>
                  </>
                )}

                {(selectedElement.type === 'seat' || selectedElement.type === 'text') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Розмір місця / Тексту</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range"
                        min="5"
                        max="100"
                        value={selectedElement.radius || 15}
                        onChange={(e) => updateElement(selectedElement.id, { radius: parseInt(e.target.value) })}
                        className="flex-1 accent-neon-purple"
                      />
                      <span className="text-xs font-mono text-zinc-400">{selectedElement.radius || 15}</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedElement.type === 'table' && (
                <>
                  <button 
                    onClick={() => addElement('seat', selectedElement.id)}
                    className="w-full py-3 bg-neon-purple/20 hover:bg-neon-purple/30 text-neon-purple rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-neon-purple/20"
                  >
                    <Plus size={16} /> Додати місце до столу
                  </button>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Кількість місць</label>
                    <input 
                      type="number"
                      value={selectedElement.seatsCount || 4}
                      onChange={(e) => {
                        const count = parseInt(e.target.value);
                        const updates: Partial<ChartElement> = { seatsCount: count };
                        if (count === 8) {
                          updates.width = 120;
                          updates.height = 60;
                        } else if (count === 4 || count === 5) {
                          updates.width = 60;
                          updates.height = 60;
                        }
                        updateElement(selectedElement.id, updates);
                      }}
                      className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-purple outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-2xl border border-white/5">
                    <input 
                      type="checkbox"
                      checked={selectedElement.sellAsWhole}
                      onChange={(e) => updateElement(selectedElement.id, { sellAsWhole: e.target.checked })}
                      className="w-4 h-4 accent-neon-purple"
                    />
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Продавати як цілий стіл</label>
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-2xl border border-white/5">
                <input 
                  type="checkbox"
                  checked={selectedElement.isBlocked}
                  onChange={(e) => updateElement(selectedElement.id, { isBlocked: e.target.checked })}
                  className="w-4 h-4 accent-red-500"
                />
                <label className="text-[10px] font-black uppercase tracking-widest text-red-500">Заблокувати</label>
              </div>

              {selectedElement.type === 'fanzone' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block ml-1">Місткість (людей)</label>
                  <input 
                    type="number"
                    value={selectedElement.capacity || 0}
                    onChange={(e) => updateElement(selectedElement.id, { capacity: parseInt(e.target.value) })}
                    className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-purple outline-none"
                  />
                </div>
              )}

              <button 
                onClick={() => removeElement(selectedElement.id)}
                className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-red-500/10"
              >
                <Trash2 size={16} /> Видалити елемент
              </button>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-600">
                <Settings size={24} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Оберіть елемент на схемі для редагування</p>
            </div>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto p-12 bg-[#050505] relative">
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[18vw] font-black text-white/[0.01] select-none tracking-tighter">
            HALL EDITOR
          </div>
          <SeatingChartCanvas 
            elements={elements}
            backgroundImage={background}
            isAdmin
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={setElements}
            width={1200}
            height={800}
          />
        </div>
      </div>
    </div>
  );
}

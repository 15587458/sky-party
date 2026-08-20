import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Move, 
  Square, 
  Circle as CircleIcon, 
  Type, 
  Save, 
  Layout, 
  Box, 
  Copy, 
  Crown, 
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Compass,
  Check,
  X,
  Layers,
  MapPin,
  Sliders,
  Sun,
  Grid,
  Building2,
  Maximize2
} from 'lucide-react';
import SeatingChartCanvas from './SeatingChartCanvas';
import Zosyna3DHall from './Zosyna3DHall';
import { ChartElement, TerritoryConfig } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SeatingChartEditorProps {
  initialElements?: ChartElement[];
  initialBackground?: string;
  initialTerritory?: TerritoryConfig;
  onSave: (elements: ChartElement[], background?: string, territory?: TerritoryConfig) => void;
  onCancel: () => void;
}

const COLOR_PRESETS = [
  { name: 'VIP Золотий', color: '#eab308', isVip: true },
  { name: 'Фан-зона Пурпур', color: '#9333ea', isVip: false },
  { name: 'Смарагдовий', color: '#22c55e', isVip: false },
  { name: 'Неоновий синій', color: '#38bdf8', isVip: false },
  { name: 'Рожевий', color: '#ec4899', isVip: false },
  { name: 'Темний графіт', color: '#3f3f46', isVip: false },
];

const DEFAULT_TERRITORY: TerritoryConfig = {
  width: 1200,
  height: 800,
  venueType: 'club',
  floorMaterial: 'concrete',
  wallHeight: 18,
  showWalls: true,
  lightingPreset: 'club',
  ambientIntensity: 0.6,
  pointIntensity: 1.2,
  showGrid: true,
  floorColor: '#18181b',
  wallColor: '#27272a'
};

const TERRITORY_PRESETS = [
  { name: 'Стандартна ZOSYNA', width: 1200, height: 800, type: 'club', floor: 'concrete' },
  { name: 'Компактний клуб', width: 1000, height: 700, type: 'club', floor: 'dancefloor' },
  { name: 'Великий концерт-хол', width: 1600, height: 1000, type: 'club', floor: 'wood' },
  { name: 'Фестиваль / Open-Air', width: 2000, height: 1200, type: 'open_air', floor: 'grid' },
  { name: 'Банкетний ресторан', width: 1300, height: 850, type: 'banquet', floor: 'marble' },
];

export default function SeatingChartEditor({ 
  initialElements = [], 
  initialBackground = '', 
  initialTerritory,
  onSave, 
  onCancel 
}: SeatingChartEditorProps) {
  const [elements, setElements] = useState<ChartElement[]>(initialElements);
  const [background, setBackground] = useState<string>(initialBackground);
  const [territory, setTerritory] = useState<TerritoryConfig>(initialTerritory || DEFAULT_TERRITORY);
  const [activeTab, setActiveTab] = useState<'element' | 'territory'>('element');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'2d' | '3d'>('3d');
  const [moveStep, setMoveStep] = useState<number>(5);

  const selectedElement = elements.find(el => el.id === selectedId);

  // When an element is selected, switch to element tab automatically if in territory tab
  const handleSelectElement = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      setActiveTab('element');
    }
  };

  // Keyboard navigation & movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;
      
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const step = e.shiftKey ? 15 : moveStep;
      const el = elements.find(item => item.id === selectedId);
      if (!el) return;

      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeElement(selectedId);
        return;
      }
      else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateElement(selectedId);
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
  }, [selectedId, moveStep, elements]);

  // Add new element to scene
  const addElement = (type: ChartElement['type'], parentId?: string) => {
    const id = `${type}-${Date.now()}`;
    const nextTableNum = elements.filter(e => e.type === 'table').length + 1;
    
    // Spawn near center based on territory dimensions
    const centerX = Math.round((territory.width || 1200) / 2);
    const centerY = Math.round((territory.height || 800) / 2);

    const newEl: ChartElement = {
      id,
      type,
      x: parentId ? 50 : centerX,
      y: parentId ? 50 : centerY,
      label: type === 'table' ? `Стіл ${nextTableNum}` : type === 'seat' ? (elements.filter(e => e.type === 'seat').length + 1).toString() : '',
      priceType: type === 'table' ? 'vip' : 'standard',
      fill: type === 'table' ? '#eab308' : type === 'fanzone' ? '#9333ea' : undefined,
      parentId,
    };

    if (type === 'seat') {
      newEl.radius = 15;
    } else if (type === 'table') {
      newEl.width = 70;
      newEl.height = 50;
      newEl.seatsCount = 6;
      newEl.sellAsWhole = true;
    } else if (type === 'fanzone') {
      newEl.width = 220;
      newEl.height = 110;
      newEl.capacity = 150;
      newEl.label = 'ФАН-ЗОНА';
    } else if (type === 'shape') {
      newEl.width = 320;
      newEl.height = 110;
      newEl.label = 'СЦЕНА';
      newEl.fill = '#27272a';
    } else if (type === 'text') {
      newEl.label = 'НАПИС';
      newEl.fill = '#ffffff';
      newEl.radius = 20;
    }

    setElements([...elements, newEl]);
    setSelectedId(id);
    setActiveTab('element');
  };

  const updateElement = (id: string, updates: Partial<ChartElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const updateTerritory = (updates: Partial<TerritoryConfig>) => {
    setTerritory(prev => ({ ...prev, ...updates }));
  };

  const duplicateElement = (id: string) => {
    const el = elements.find(item => item.id === id);
    if (!el) return;

    const newId = `${el.type}-${Date.now()}`;
    const nextTableNum = elements.filter(e => e.type === 'table').length + 1;
    const newEl: ChartElement = {
      ...el,
      id: newId,
      x: el.x + 35,
      y: el.y + 25,
      label: el.type === 'table' ? `Стіл ${nextTableNum}` : el.label ? `${el.label} (копія)` : '',
    };

    setElements([...elements, newEl]);
    setSelectedId(newId);
    setActiveTab('element');
  };

  const removeElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id && el.parentId !== id));
    setSelectedId(null);
  };

  // Move element by offset
  const nudgeElement = (dx: number, dy: number) => {
    if (!selectedId) return;
    setElements(prev => prev.map(item => {
      if (item.id === selectedId) {
        return { ...item, x: item.x + dx, y: item.y + dy };
      }
      return item;
    }));
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Top Header & Toolbar */}
      <div className="p-3 sm:p-4 border-b border-white/10 bg-zinc-900/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mode Switcher & Add Tools */}
        <div className="flex items-center flex-wrap gap-2">
          {/* 2D / 3D Mode Toggle */}
          <div className="flex items-center p-1 bg-zinc-950 rounded-2xl border border-white/10 shadow-inner">
            <button
              onClick={() => setEditorMode('3d')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                editorMode === '3d' 
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" 
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Box size={15} /> 3D Редактор
            </button>
            <button
              onClick={() => setEditorMode('2d')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                editorMode === '2d' 
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" 
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Square size={15} /> 2D Схема
            </button>
          </div>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />

          {/* Add Elements Buttons */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => addElement('table')}
              className="px-3 py-2 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider active:scale-95 shadow-sm"
              title="Додати VIP стіл"
            >
              <Crown size={15} /> + Стіл VIP
            </button>
            <button 
              onClick={() => addElement('fanzone')}
              className="px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider active:scale-95 shadow-sm"
              title="Додати фан-зону"
            >
              <Layout size={15} /> + Фан-зона
            </button>
            <button 
              onClick={() => addElement('shape')}
              className="px-3 py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider active:scale-95 shadow-sm"
              title="Додати сцену або блок"
            >
              <Layout size={14} /> + Сцена/Блок
            </button>
            <button 
              onClick={() => addElement('seat')}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider active:scale-95"
              title="Додати окреме місце"
            >
              <CircleIcon size={14} /> + Місце
            </button>
            <button 
              onClick={() => addElement('text')}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider active:scale-95"
              title="Додати напис"
            >
              <Type size={14} /> + Текст
            </button>
          </div>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />

          {/* Switch to Territory Settings Button */}
          <button
            onClick={() => setActiveTab('territory')}
            className={cn(
              "px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider active:scale-95 border",
              activeTab === 'territory'
                ? "bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-sm"
                : "bg-zinc-800 hover:bg-zinc-750 border-white/5 text-zinc-300 hover:text-white"
            )}
            title="Редагувати параметри залу та території"
          >
            <Building2 size={15} /> Територія залу ({territory.width}×{territory.height})
          </button>
        </div>

        {/* Right: Background Upload, Cancel & Save */}
        <div className="flex items-center gap-2">
          {editorMode === '2d' && (
            <label className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider cursor-pointer border border-white/5">
              <Move size={14} /> Фон
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
          )}

          <button 
            onClick={onCancel}
            className="text-zinc-400 hover:text-white px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Скасувати
          </button>
          <button 
            onClick={() => onSave(elements, background, territory)}
            className="bg-white text-black hover:bg-yellow-400 px-5 sm:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <Save size={16} /> Зберегти схему
          </button>
        </div>
      </div>

      {/* Main Content: Sidebar Properties & 2D/3D Canvas */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Properties Panel */}
        <div className="w-80 lg:w-92 border-r border-white/10 bg-zinc-900/60 backdrop-blur-md p-5 overflow-y-auto space-y-5 shrink-0 select-none">
          {/* Tabs: Element Properties vs Territory Settings */}
          <div className="flex items-center p-1 bg-zinc-950 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab('element')}
              className={cn(
                "flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                activeTab === 'element'
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Settings size={13} /> Елемент {selectedElement ? `(${selectedElement.label || selectedElement.type})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('territory')}
              className={cn(
                "flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                activeTab === 'territory'
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Building2 size={13} /> Територія
            </button>
          </div>

          {activeTab === 'territory' ? (
            /* TERRITORY & VENUE SETTINGS */
            <div className="space-y-5 animate-in fade-in">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Building2 size={15} /> Налаштування території залу
                </h3>
                <p className="text-[10px] text-zinc-400">
                  Змінюйте розміри, покриття підлоги, висоту стін та світлову атмосферу 2D/3D простору
                </p>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                  Шаблони локацій
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {TERRITORY_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        updateTerritory({
                          width: preset.width,
                          height: preset.height,
                          venueType: preset.type as any,
                          floorMaterial: preset.floor as any
                        });
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border text-left flex items-center justify-between transition-all text-xs font-bold",
                        territory.width === preset.width && territory.height === preset.height && territory.venueType === preset.type
                          ? "bg-purple-600/20 border-purple-500 text-white"
                          : "bg-zinc-950 border-white/5 text-zinc-300 hover:bg-zinc-800"
                      )}
                    >
                      <span>{preset.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{preset.width} × {preset.height} px</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Territory Width & Height Inputs */}
              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                    <Maximize2 size={13} className="text-purple-400" /> Габарити залу (2D/3D)
                  </label>
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-lg border border-purple-500/30">
                    {territory.width} × {territory.height}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1">
                      <span>Ширина залу</span>
                      <span className="font-mono text-white">{territory.width || 1200} px</span>
                    </div>
                    <input 
                      type="range"
                      min="800"
                      max="2400"
                      step="50"
                      value={territory.width || 1200}
                      onChange={(e) => updateTerritory({ width: parseInt(e.target.value) || 1200 })}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1">
                      <span>Довжина / Глибина залу</span>
                      <span className="font-mono text-white">{territory.height || 800} px</span>
                    </div>
                    <input 
                      type="range"
                      min="600"
                      max="1800"
                      step="50"
                      value={territory.height || 800}
                      onChange={(e) => updateTerritory({ height: parseInt(e.target.value) || 800 })}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Venue Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                  Тип майданчика (Venue Type)
                </label>
                <select
                  value={territory.venueType || 'club'}
                  onChange={(e) => updateTerritory({ venueType: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="club">🍸 Нічний клуб / Концерт-хол</option>
                  <option value="open_air">🎪 Відкритий фестиваль / Open-Air</option>
                  <option value="banquet">🍽️ Банкетний ресторан / Зал</option>
                  <option value="arena">🏟️ Арена / Стадіон</option>
                </select>
              </div>

              {/* Floor Material */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                  Текстура підлоги (3D/2D)
                </label>
                <select
                  value={territory.floorMaterial || 'concrete'}
                  onChange={(e) => updateTerritory({ floorMaterial: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="concrete">⬛ Темний полірований бетон</option>
                  <option value="wood">🪵 Світлий благородний паркет</option>
                  <option value="dancefloor">✨ Глянцевий сценічний танцпол</option>
                  <option value="marble">🏛️ Темний мармур / Граніт</option>
                  <option value="grid">⚡ Кібер-решітка (Cyber Grid)</option>
                </select>
              </div>

              {/* Lighting Mood Preset */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                  Світлова атмосфера (3D Lighting)
                </label>
                <select
                  value={territory.lightingPreset || 'club'}
                  onChange={(e) => updateTerritory({ lightingPreset: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="club">🟣 Клубний неоновий драйв (Пурпур & Неон)</option>
                  <option value="warm">🕯️ Теплий затишний зал (Золотавий)</option>
                  <option value="concert">🌈 Яскраве сценічне шоу (Динамічні промені)</option>
                  <option value="minimal">💡 Стриманий мінімалізм (Чисте світло)</option>
                </select>
              </div>

              {/* Wall Height & Perimeter Visibility */}
              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/10 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                  <Building2 size={13} className="text-purple-400" /> Периметр та стіни
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={territory.showWalls ?? true}
                    onChange={(e) => updateTerritory({ showWalls: e.target.checked })}
                    className="w-4 h-4 accent-purple-500 rounded"
                  />
                  <span className="text-xs font-bold text-zinc-300">Відображати стіни по периметру</span>
                </label>

                {territory.showWalls && (
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1">
                      <span>Висота стін</span>
                      <span className="font-mono text-white">{territory.wallHeight || 18} м</span>
                    </div>
                    <input 
                      type="range"
                      min="6"
                      max="32"
                      step="2"
                      value={territory.wallHeight || 18}
                      onChange={(e) => updateTerritory({ wallHeight: parseInt(e.target.value) || 18 })}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                )}
              </div>

              {/* Grid Toggle */}
              <label className="flex items-center gap-3 p-3 bg-zinc-950/60 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-950 transition-colors">
                <input 
                  type="checkbox"
                  checked={territory.showGrid ?? true}
                  onChange={(e) => updateTerritory({ showGrid: e.target.checked })}
                  className="w-4 h-4 accent-purple-500 rounded"
                />
                <span className="text-xs font-bold text-zinc-300">Показувати розмітку сітки (2D Grid)</span>
              </label>
            </div>
          ) : selectedElement ? (
            /* ELEMENT PROPERTIES */
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                  <Settings size={14} /> Властивості елемента
                </h3>
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-400 text-[9px] font-black uppercase tracking-wider border border-purple-500/30">
                  {selectedElement.type}
                </span>
              </div>

              {/* Element Label / Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                  Етикетка / Номер
                </label>
                <input 
                  type="text"
                  value={selectedElement.label || ''}
                  onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                  placeholder="Наприклад: Стіл 15"
                  className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              {/* Price Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                  Категорія ціни
                </label>
                <select 
                  value={selectedElement.priceType || 'standard'}
                  onChange={(e) => updateElement(selectedElement.id, { priceType: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="vip">👑 VIP (Жовтий стіл)</option>
                  <option value="standard">🎫 Standard</option>
                </select>
              </div>

              {/* Table / Zone Color Palette */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                  Колір столу / зони
                </label>
                
                {/* Palette Quick Selectors */}
                <div className="grid grid-cols-6 gap-1.5">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => updateElement(selectedElement.id, { fill: preset.color })}
                      style={{ backgroundColor: preset.color }}
                      className={cn(
                        "w-full aspect-square rounded-xl transition-all relative border border-white/20 shadow-sm active:scale-90",
                        selectedElement.fill === preset.color && "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-105"
                      )}
                      title={preset.name}
                    >
                      {selectedElement.fill === preset.color && (
                        <Check size={12} className="text-black mx-auto drop-shadow-sm font-black" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="color"
                    value={selectedElement.fill || '#eab308'}
                    onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                    className="w-9 h-9 bg-transparent rounded-xl cursor-pointer border border-white/10"
                  />
                  <input 
                    type="text"
                    placeholder="#eab308"
                    value={selectedElement.fill || ''}
                    onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                    className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Seats count for tables */}
              {selectedElement.type === 'table' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                    Кількість місць за столом
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      min="1"
                      max="20"
                      value={selectedElement.seatsCount || 6}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 4;
                        updateElement(selectedElement.id, { seatsCount: count });
                      }}
                      className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <div className="flex gap-1">
                      {[4, 6, 8].map((seats) => (
                        <button
                          key={seats}
                          type="button"
                          onClick={() => updateElement(selectedElement.id, { seatsCount: seats })}
                          className={cn(
                            "px-2.5 py-2 rounded-xl text-xs font-bold border transition-all",
                            selectedElement.seatsCount === seats 
                              ? "bg-purple-600 text-white border-purple-500" 
                              : "bg-zinc-800 text-zinc-400 border-white/5 hover:text-white"
                          )}
                        >
                          {seats}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Fanzone Info & Capacity */}
              {selectedElement.type === 'fanzone' && (
                <div className="p-3.5 bg-purple-500/10 rounded-2xl border border-purple-500/20 space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 block">
                    Фан-зона (Загальний вхід)
                  </span>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Місткість (чоловік)</label>
                    <input 
                      type="number"
                      min="10"
                      max="10000"
                      value={selectedElement.capacity || 150}
                      onChange={(e) => updateElement(selectedElement.id, { capacity: parseInt(e.target.value) || 100 })}
                      className="w-full bg-zinc-950 border border-purple-500/30 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Dimensions: Width & Height */}
              {(selectedElement.type === 'table' || selectedElement.type === 'fanzone' || selectedElement.type === 'shape') && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                    Розміри (Ширина × Висота)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Ширина (px)</span>
                      <input 
                        type="number"
                        min="20"
                        max="800"
                        step="5"
                        value={Math.round(selectedElement.width || (selectedElement.type === 'table' ? 70 : selectedElement.type === 'fanzone' ? 220 : 320))}
                        onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) || 40 })}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Висота (px)</span>
                      <input 
                        type="number"
                        min="20"
                        max="800"
                        step="5"
                        value={Math.round(selectedElement.height || (selectedElement.type === 'table' ? 50 : selectedElement.type === 'fanzone' ? 110 : 110))}
                        onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) || 40 })}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Rotation & Angle Controls (2D and 3D) */}
              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                    <Compass size={13} className="text-purple-400" /> Кут розвороту
                  </label>
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-lg border border-purple-500/30">
                    {Math.round(selectedElement.rotation || 0)}°
                  </span>
                </div>

                {/* Slider */}
                <input 
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={Math.round(selectedElement.rotation || 0)}
                  onChange={(e) => updateElement(selectedElement.id, { rotation: parseInt(e.target.value) || 0 })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />

                {/* Quick step buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedElement.rotation || 0;
                      const next = (cur - 45 + 360) % 360;
                      updateElement(selectedElement.id, { rotation: next });
                    }}
                    className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 border border-white/5 active:scale-95 transition-all"
                  >
                    <RotateCcw size={11} /> -45°
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedElement.rotation || 0;
                      const next = (cur + 45) % 360;
                      updateElement(selectedElement.id, { rotation: next });
                    }}
                    className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 border border-white/5 active:scale-95 transition-all"
                  >
                    <RotateCw size={11} /> +45°
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedElement.rotation || 0;
                      const next = (cur + 90) % 360;
                      updateElement(selectedElement.id, { rotation: next });
                    }}
                    className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 border border-white/5 active:scale-95 transition-all"
                  >
                    <RotateCw size={11} /> +90°
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElement(selectedElement.id, { rotation: 0 })}
                    className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[10px] font-bold flex items-center justify-center border border-white/5 active:scale-95 transition-all"
                  >
                    0°
                  </button>
                </div>
              </div>

              {/* 3D & 2D Transformation / Position D-Pad */}
              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                    <Move size={12} /> Позиція в 3D / 2D
                  </label>
                  
                  {/* Step Selector */}
                  <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-white/5">
                    {[1, 5, 20].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMoveStep(s)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                          moveStep === s ? "bg-purple-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {s}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Directional Nudge D-Pad */}
                <div className="flex flex-col items-center gap-1 py-1">
                  <button
                    type="button"
                    onClick={() => nudgeElement(0, -moveStep)}
                    className="w-10 h-9 rounded-xl bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 border border-white/10 flex items-center justify-center transition-all active:scale-90 shadow-sm"
                    title="Вгору / До сцени"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => nudgeElement(-moveStep, 0)}
                      className="w-10 h-9 rounded-xl bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 border border-white/10 flex items-center justify-center transition-all active:scale-90 shadow-sm"
                      title="Вліво"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className="text-[10px] font-mono text-zinc-400 px-2 text-center">
                      X: {Math.round(selectedElement.x)}<br />Y: {Math.round(selectedElement.y)}
                    </div>
                    <button
                      type="button"
                      onClick={() => nudgeElement(moveStep, 0)}
                      className="w-10 h-9 rounded-xl bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 border border-white/10 flex items-center justify-center transition-all active:scale-90 shadow-sm"
                      title="Вправо"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => nudgeElement(0, moveStep)}
                    className="w-10 h-9 rounded-xl bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 border border-white/10 flex items-center justify-center transition-all active:scale-90 shadow-sm"
                    title="Вниз / Від сцени"
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>

              {/* Checkboxes: Sell as whole & Blocked */}
              <div className="space-y-2">
                {selectedElement.type === 'table' && (
                  <label className="flex items-center gap-3 p-3 bg-zinc-950/60 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-950 transition-colors">
                    <input 
                      type="checkbox"
                      checked={selectedElement.sellAsWhole ?? true}
                      onChange={(e) => updateElement(selectedElement.id, { sellAsWhole: e.target.checked })}
                      className="w-4 h-4 accent-purple-500 rounded"
                    />
                    <span className="text-xs font-bold text-zinc-300">Продавати як цілий стіл</span>
                  </label>
                )}

                <label className="flex items-center gap-3 p-3 bg-zinc-950/60 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-950 transition-colors">
                  <input 
                    type="checkbox"
                    checked={selectedElement.isBlocked || false}
                    onChange={(e) => updateElement(selectedElement.id, { isBlocked: e.target.checked })}
                    className="w-4 h-4 accent-red-500 rounded"
                  />
                  <span className="text-xs font-bold text-red-400">Заблокувати стіл / місце</span>
                </label>
              </div>

              {/* Action Buttons: Duplicate & Delete */}
              <div className="pt-2 space-y-2">
                <button 
                  type="button"
                  onClick={() => duplicateElement(selectedElement.id)}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10 active:scale-95"
                >
                  <Copy size={15} /> Дублювати {selectedElement.type === 'text' ? 'напис' : selectedElement.type === 'table' ? 'стіл' : selectedElement.type === 'fanzone' ? 'фан-зону' : 'елемент'}
                </button>
                <button 
                  type="button"
                  onClick={() => removeElement(selectedElement.id)}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-red-500/20 active:scale-95"
                >
                  <Trash2 size={15} /> Видалити елемент
                </button>
              </div>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
                <Box size={26} />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Клікніть на стіл або фан-зону в 3D/2D для редагування
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('territory')}
                className="mt-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all"
              >
                🏛️ Налаштувати територію залу
              </button>
            </div>
          )}
        </div>

        {/* Main Workspace Area: 3D Scene or 2D Canvas */}
        <div className="flex-1 bg-[#050505] relative overflow-hidden flex items-center justify-center">
          {editorMode === '3d' ? (
            <div className="w-full h-full relative">
              <Zosyna3DHall 
                elements={elements}
                territory={territory}
                selectedId={selectedId}
                onSelect={(el) => handleSelectElement(el.id)}
                onElementMove={(id, x, y) => updateElement(id, { x, y })}
                editable={true}
                className="w-full h-full"
              />
              
              {/* 3D Editor Banner Overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-950/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl pointer-events-none hidden md:flex items-center gap-3 text-xs text-zinc-300 z-10">
                <span className="flex items-center gap-1.5 font-bold text-yellow-400">
                  <Sparkles size={14} /> 3D Режим редагування
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">Перетягуйте столи мишкою прямо в 3D • Кнопки D-Pad або стрілки для точного зміщення</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full overflow-auto p-8 relative flex items-center justify-center">
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[18vw] font-black text-white/[0.01] select-none tracking-tighter">
                2D SCHEME
              </div>
              <SeatingChartCanvas 
                elements={elements}
                backgroundImage={background}
                territory={territory}
                isAdmin
                selectedId={selectedId}
                onSelect={handleSelectElement}
                onUpdate={setElements}
                width={territory.width || 1200}
                height={territory.height || 800}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

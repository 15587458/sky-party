import React, { useRef, useEffect, useState } from 'react';
import { Bold, Type, RefreshCw, Eye } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const FONTS = [
  { name: 'Montserrat (Без засічок - за замовчуванням)', value: 'Montserrat, sans-serif' },
  { name: 'Space Grotesk (Технологічний)', value: 'Space Grotesk, sans-serif' },
  { name: 'Playfair Display (Елегантна класика)', value: 'Playfair Display, serif' },
  { name: 'JetBrains Mono (Моноширинний/Код)', value: 'JetBrains Mono, monospace' },
  { name: 'Inter (Чистий європейський)', value: 'Inter, sans-serif' }
];

const SIZES = [
  { name: 'Дуже маленький (12px)', value: '1' },
  { name: 'Маленький (14px)', value: '2' },
  { name: 'Звичайний (16px)', value: '3' },
  { name: 'Великий (20px)', value: '4' },
  { name: 'Дуже великий (30px)', value: '5' },
  { name: 'Гігантський (38px)', value: '6' },
  { name: 'Максимальний (48px)', value: '7' }
];

export default function RichTextEditor({ value, onChange, placeholder = 'Введіть детальний опис тут...' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isPreview, setIsPreview] = useState(false);

  // Sync internal innerHTML with value prop only when it deviates
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, value: string = '') => {
    // Focus the editor first to ensure selection remains inside
    editorRef.current?.focus();
    
    // Enable styleWithCSS where appropriate
    try {
      document.execCommand('styleWithCSS', false, 'false');
    } catch (e) {}

    document.execCommand(command, false, value);
    handleInput();
  };

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-950/40 overflow-hidden shadow-2xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-900 border-b border-zinc-800/80">
        <button
          type="button"
          onClick={() => executeCommand('bold')}
          className="p-2 bg-zinc-800 hover:bg-purple-600/30 hover:text-purple-400 text-zinc-300 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-white/5"
          title="Жирний (Ctrl+B)"
        >
          <Bold size={16} />
        </button>

        {/* Font Family Selector */}
        <div className="flex items-center gap-1.5 bg-zinc-800 px-2.5 py-1.5 rounded-xl border border-white/5">
          <Type size={14} className="text-zinc-500" />
          <select
            onChange={(e) => executeCommand('fontName', e.target.value)}
            defaultValue=""
            className="bg-transparent text-xs text-zinc-300 outline-none cursor-pointer max-w-[200px]"
            title="Оберіть шрифт для виділеного тексту"
          >
            <option value="" disabled className="bg-zinc-900">Шрифт...</option>
            {FONTS.map((f) => (
              <option key={f.value} value={f.value} className="bg-zinc-900 text-zinc-200">
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size Selector */}
        <div className="flex items-center gap-1.5 bg-zinc-800 px-2.5 py-1.5 rounded-xl border border-white/5">
          <span className="text-xs font-bold text-zinc-500">Аа</span>
          <select
            onChange={(e) => executeCommand('fontSize', e.target.value)}
            defaultValue=""
            className="bg-transparent text-xs text-zinc-300 outline-none cursor-pointer"
            title="Оберіть розмір виділеного тексту"
          >
            <option value="" disabled className="bg-zinc-900">Розмір...</option>
            {SIZES.map((s) => (
              <option key={s.value} value={s.value} className="bg-zinc-900 text-zinc-200 block">
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Preview / Edit Toggle */}
        <button
          type="button"
          onClick={() => setIsPreview(!isPreview)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            isPreview 
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-white/5'
          }`}
        >
          {isPreview ? <RefreshCw size={12} /> : <Eye size={12} />}
          {isPreview ? 'Режим редагування' : 'Попередній перегляд'}
        </button>
      </div>

      {/* Editor Body */}
      <div className="relative">
        {!isPreview ? (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleInput}
            className="w-full min-h-[250px] max-h-[500px] overflow-y-auto bg-zinc-900 p-6 focus:ring-1 focus:ring-purple-500/30 outline-none text-zinc-200 text-sm leading-relaxed rich-text-content"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
            data-placeholder={placeholder}
          />
        ) : (
          <div 
            className="w-full min-h-[250px] max-h-[500px] overflow-y-auto bg-zinc-950 p-6 text-zinc-200 text-sm leading-relaxed rich-text-content select-none prose prose-invert"
            dangerouslySetInnerHTML={{ __html: value || `<p class="text-zinc-500 italic">${placeholder}</p>` }}
          />
        )}
      </div>
      
      {/* Footer Info */}
      <div className="bg-zinc-900/50 px-4 py-2 border-t border-zinc-800/80 flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
        <span>Виділіть текст, щоб застосувати форматування</span>
        <span>Символів: {value ? value.replace(/<[^>]*>/g, '').length : 0}</span>
      </div>
    </div>
  );
}

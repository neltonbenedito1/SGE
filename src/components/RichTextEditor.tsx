import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  RemoveFormatting,
} from 'lucide-react';
import { sanitizeHtml } from '../lib/sanitize';

interface RichTextEditorProps {
  value: string;
  onChange: (sanitizedHtml: string) => void;
  placeholder?: string;
  minHeightClass?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Escreva a resposta detalhada...',
  minHeightClass = 'min-h-[190px]',
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (!editorRef.current) return;
    const sanitized = sanitizeHtml(value || '');
    if (editorRef.current.innerHTML !== sanitized && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = sanitized;
    }
  }, [value]);

  const emitChange = () => {
    if (!editorRef.current) return;
    const cleaned = sanitizeHtml(editorRef.current.innerHTML);
    onChange(cleaned);
  };

  const exec = (command: string, val?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, val);
    emitChange();
  };

  const handleApplyLink = () => {
    const trimmed = linkUrl.trim();
    if (!/^(https?:\/\/|\/)/i.test(trimmed)) {
      setLinkError('Informe um endereço válido iniciado por https:// ou /');
      return;
    }
    setLinkError('');
    exec('createLink', trimmed);
    setShowLinkInput(false);
    setLinkUrl('https://');
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => exec('bold')}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Negrito"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Itálico"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Sublinhado"
        >
          <Underline className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => exec('formatBlock', '<h3>')}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Subtítulo"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Lista"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Lista Numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', '<blockquote>')}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Citação"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => {
            setLinkError('');
            setShowLinkInput((prev) => !prev);
          }}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Inserir Ligação"
        >
          <Link2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('removeFormat')}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Limpar Formatação"
        >
          <RemoveFormatting className="w-4 h-4" />
        </button>
      </div>

      {showLinkInput && (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://exemplo.edu.mz/guia"
            className="flex-1 min-w-[200px] px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleApplyLink}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
          >
            Aplicar Link
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            Cancelar
          </button>
          {linkError && <p className="w-full text-[11px] text-rose-500 font-medium">{linkError}</p>}
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        onInput={emitChange}
        onBlur={emitChange}
        data-placeholder={placeholder}
        className={`${minHeightClass} max-h-[340px] overflow-y-auto px-4 py-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none prose prose-sm dark:prose-invert max-w-none [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-indigo-600 [&_a]:underline empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400`}
      />
    </div>
  );
};

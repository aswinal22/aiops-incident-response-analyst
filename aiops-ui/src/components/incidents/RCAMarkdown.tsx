import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  FileText,
  Activity,
  Code2,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Layers,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface RCAMarkdownProps {
  content?: string;
  markdown?: string;
}

interface ParsedSection {
  id: string;
  num: string;
  title: string;
  content: string;
}

const SECTION_ICONS: Record<string, React.ElementType> = {
  '1': FileText,
  '2': Activity,
  '3': Code2,
  '4': AlertTriangle,
  '5': ShieldCheck,
};

const SECTION_COLORS: Record<string, { badge: string; border: string; bg: string; text: string }> = {
  '1': {
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    border: 'border-blue-500/30',
    bg: 'from-blue-950/30 to-slate-900/40',
    text: 'text-blue-300',
  },
  '2': {
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    border: 'border-amber-500/30',
    bg: 'from-amber-950/30 to-slate-900/40',
    text: 'text-amber-300',
  },
  '3': {
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    border: 'border-purple-500/30',
    bg: 'from-purple-950/30 to-slate-900/40',
    text: 'text-purple-300',
  },
  '4': {
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    border: 'border-rose-500/30',
    bg: 'from-rose-950/30 to-slate-900/40',
    text: 'text-rose-300',
  },
  '5': {
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    border: 'border-emerald-500/30',
    bg: 'from-emerald-950/30 to-slate-900/40',
    text: 'text-emerald-300',
  },
};

const parseRCASections = (markdownText: string): { title: string; sections: ParsedSection[] } => {
  if (!markdownText) return { title: '', sections: [] };

  const titleMatch = markdownText.match(/^#\s+([^\n]+)/m);
  const title = titleMatch ? titleMatch[1] : 'Incident Root Cause Analysis (RCA) Report';

  const sectionSplitPattern = /(?=(?:^|\n)##\s+)/;
  const rawParts = markdownText.split(sectionSplitPattern);

  const sections: ParsedSection[] = [];
  let currentNum = 1;

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed || (trimmed.startsWith('# ') && !trimmed.startsWith('## '))) {
      continue;
    }

    const headerMatch = trimmed.match(/^##\s+(\d+[\.\:\)]?\s*)?([^\n]+)/);
    if (headerMatch) {
      const explicitNumMatch = headerMatch[1]?.match(/\d+/);
      const num = explicitNumMatch ? explicitNumMatch[0] : String(currentNum);
      const sectionTitle = headerMatch[2]?.trim() || `Section ${num}`;
      const content = trimmed.replace(/^##\s+[^\n]+\n?/, '').trim();

      sections.push({
        id: `section-${num}`,
        num,
        title: sectionTitle,
        content,
      });
      currentNum++;
    }
  }

  return { title, sections };
};

export const RCAMarkdown: React.FC<RCAMarkdownProps> = ({ content, markdown }) => {
  const textContent = content || markdown || '';
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string>('all');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'section-1': true,
    'section-2': true,
    'section-3': true,
    'section-4': true,
    'section-5': true,
  });

  const { sections } = useMemo(() => parseRCASections(textContent), [textContent]);

  if (!textContent) {
    return (
      <div className="p-8 text-center text-slate-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No RCA report available for this incident.
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allOpen: Record<string, boolean> = {};
    sections.forEach((s) => (allOpen[s.id] = true));
    setOpenSections(allOpen);
  };

  const collapseAll = () => {
    const allClosed: Record<string, boolean> = {};
    sections.forEach((s) => (allClosed[s.id] = false));
    setOpenSections(allClosed);
  };

  const markdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="text-sm font-bold text-slate-100 border-b border-border pb-1.5 mt-3 mb-2 tracking-tight">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xs font-bold text-blue-300 border-b border-slate-800/80 pb-1 mt-3 mb-2">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-xs font-semibold text-slate-200 mt-2.5 mb-1.5">
        {children}
      </h3>
    ),
    p: ({ children }: any) => <p className="mb-2 text-slate-300 leading-relaxed">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2.5 space-y-1 text-slate-300 leading-relaxed">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2.5 space-y-1 text-slate-300 leading-relaxed">{children}</ol>,
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-3 border border-border/70 rounded-xl bg-slate-950/60 shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-border">
        {children}
      </thead>
    ),
    th: ({ children }: any) => (
      <th className="py-2.5 px-4 font-semibold text-[11px] uppercase tracking-wider text-slate-300 border-b border-border">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="py-2.5 px-4 text-slate-200 border-b border-border/40 font-sans text-xs leading-relaxed align-top">
        {children}
      </td>
    ),
    tr: ({ children }: any) => (
      <tr className="hover:bg-slate-900/40 transition-colors border-b border-border/30 last:border-b-0">
        {children}
      </tr>
    ),
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const isBlock = match || codeString.includes('\n');

      if (isBlock) {
        return (
          <div className="relative group my-2.5">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border border-b-0 border-slate-800 rounded-t-lg text-[10px] text-slate-400 font-mono">
              <span className="font-semibold text-purple-300">{match ? match[1].toUpperCase() : 'SNIPPET'}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(codeString)}
                className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] flex items-center gap-1 transition-all"
              >
                {copiedCode === codeString ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="!my-0 rounded-b-lg bg-[#070b14] border border-slate-800 p-3.5 font-mono text-xs overflow-x-auto text-slate-200 leading-relaxed">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      }

      return (
        <code
          className="bg-slate-800/90 text-purple-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-purple-500/25 font-semibold mx-0.5 inline-block"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  if (sections.length === 0) {
    return (
      <div className="prose prose-invert prose-slate max-w-none text-xs leading-relaxed font-sans">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {textContent}
        </ReactMarkdown>
      </div>
    );
  }

  const displayedSections =
    selectedView === 'all'
      ? sections
      : sections.filter((_, idx) => String(idx) === selectedView);

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Top Header & Dropdown Control Bar */}
      <div className="bg-slate-900/90 border border-border rounded-xl p-3.5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>Root Cause Analysis (RCA)</span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                5 SRE Sections
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Select an investigation section from the dropdown or browse below.
            </p>
          </div>
        </div>

        {/* Dropdown Selector & Quick Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative flex-1 sm:w-64">
            <select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value)}
              className="w-full bg-[#0b101c] border border-purple-500/40 hover:border-purple-400/70 rounded-lg px-3 py-1.5 text-xs text-purple-200 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
            >
              <option value="all">📋 View All Sections (Full Report)</option>
              {sections.map((sec, idx) => (
                <option key={sec.id} value={String(idx)}>
                  {sec.num}. {sec.title}
                </option>
              ))}
            </select>
          </div>

          {selectedView === 'all' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                title="Expand all sections"
                className="p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-slate-300 border border-border transition-colors text-[10px] flex items-center gap-1 font-mono"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={collapseAll}
                title="Collapse all sections"
                className="p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-slate-300 border border-border transition-colors text-[10px] flex items-center gap-1 font-mono"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Jump Navigation Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => setSelectedView('all')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            selectedView === 'all'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
              : 'bg-surface-elevated hover:bg-surface-hover text-slate-400 border border-border'
          }`}
        >
          All (5)
        </button>
        {sections.map((sec, idx) => {
          const isSelected = selectedView === String(idx);
          const colors = SECTION_COLORS[sec.num] || SECTION_COLORS['1'];
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSelectedView(String(idx))}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'bg-surface-elevated hover:bg-surface-hover text-slate-400 border border-border'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isSelected ? 'bg-white/20 text-white' : colors.badge
                }`}
              >
                {sec.num}
              </span>
              <span>{sec.title.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Section Accordions / Focus View */}
      <div className="space-y-3">
        {displayedSections.map((sec) => {
          const isOpen = selectedView !== 'all' || openSections[sec.id] !== false;
          const Icon = SECTION_ICONS[sec.num] || FileText;
          const colors = SECTION_COLORS[sec.num] || SECTION_COLORS['1'];

          return (
            <div
              key={sec.id}
              className={`rounded-xl border ${colors.border} bg-gradient-to-r ${colors.bg} overflow-hidden shadow-md transition-all`}
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => {
                  if (selectedView === 'all') {
                    toggleSection(sec.id);
                  }
                }}
                className="w-full p-3.5 flex items-center justify-between text-left select-none bg-surface/90 hover:bg-surface-hover/80 transition-colors border-b border-border/40"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${colors.badge}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${colors.badge}`}>
                      Section {sec.num}
                    </span>
                    <h4 className="text-xs font-bold text-slate-100">{sec.title}</h4>
                  </div>
                </div>

                {selectedView === 'all' && (
                  <div className="text-slate-400 hover:text-slate-200 p-1">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                )}
              </button>

              {/* Accordion Body */}
              {isOpen && (
                <div className="p-4 bg-[#0a0f1d]/70 text-slate-300 leading-relaxed border-t border-border/30">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {sec.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


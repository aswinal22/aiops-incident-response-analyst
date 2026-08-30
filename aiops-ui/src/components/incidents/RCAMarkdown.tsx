import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, FileText } from 'lucide-react';

interface RCAMarkdownProps {
  content?: string;
}

export const RCAMarkdown: React.FC<RCAMarkdownProps> = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!content) {
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

  return (
    <div className="prose prose-invert prose-slate max-w-none text-xs leading-relaxed font-sans">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-slate-100 border-b border-border pb-2 mt-4 mb-3 tracking-tight flex items-center gap-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-blue-300 border-b border-slate-800/80 pb-1.5 mt-5 mb-2.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-semibold text-slate-200 mt-4 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 text-slate-300 leading-normal">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-slate-300">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-slate-300">{children}</ol>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 border border-border rounded-lg bg-[#0a0f1d]/40">
              <table className="w-full text-left text-xs border-collapse divide-y divide-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#0b101c] text-slate-400 font-semibold">{children}</thead>,
          th: ({ children }) => <th className="py-2 px-3 font-semibold text-[11px] text-slate-300 border-b border-border">{children}</th>,
          td: ({ children }) => <td className="py-2 px-3 text-slate-300 border-b border-border/40 font-mono text-[11px]">{children}</td>,
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (!inline) {
              return (
                <div className="relative group my-3">
                  <div className="absolute right-2 top-2 z-10">
                    <button
                      onClick={() => copyToClipboard(codeString)}
                      className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1 transition-all"
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
                  <pre className="!my-0 rounded-lg bg-[#070b14] border border-slate-800 p-4 font-mono text-xs overflow-x-auto text-slate-200">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }

            return (
              <code className="bg-slate-800/60 text-blue-300 px-1 py-0.5 rounded font-mono text-[11px]" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};


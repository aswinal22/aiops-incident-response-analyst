import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return dateString;
  }
}

export function formatLatency(ms?: number): string {
  if (ms === undefined || ms === null) return '0 ms';
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(1)} ms`;
}

export function getSeverityBadge(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    case 'high':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'medium':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'low':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    default:
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  }
}

export function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case 'investigating':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse';
    case 'mitigating':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'closed':
      return 'bg-slate-700/30 text-slate-400 border-slate-700';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}


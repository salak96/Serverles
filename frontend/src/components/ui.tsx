import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('card', className)}>{children}</div>;
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="text-ink-muted text-sm">{label}</span>
        {icon && <span className="text-accent">{icon}</span>}
      </div>
      <div className="text-2xl font-semibold text-ink">{value}</div>
      {hint && <div className="text-xs text-ink-muted">{hint}</div>}
    </Card>
  );
}

export function Badge({ children, variant = 'muted' }: { children: ReactNode; variant?: 'success' | 'warning' | 'danger' | 'muted' | 'accent' }) {
  return <span className={clsx('badge', `badge-${variant}`)}>{children}</span>;
}

export function EmptyState({ title, message, icon, action }: { title: string; message?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
      {icon && <div className="text-ink-muted">{icon}</div>}
      <h3 className="text-lg font-medium text-ink">{title}</h3>
      {message && <p className="text-ink-muted text-sm max-w-sm">{message}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('inline-block w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin', className)} />
  );
}

export function Toast({ message, variant = 'info', onClose }: { message: string; variant?: 'info' | 'success' | 'warning' | 'danger'; onClose?: () => void }) {
  const colors = {
    info: 'border-accent/40 text-ink',
    success: 'border-success/40 text-success',
    warning: 'border-warning/40 text-warning',
    danger: 'border-danger/40 text-danger',
  } as const;
  return (
    <div className={clsx('fixed bottom-4 right-4 z-50 bg-bg-card border rounded-lg shadow-soft px-4 py-3 max-w-sm', colors[variant])}>
      <div className="flex items-center gap-2">
        <span className="text-sm">{message}</span>
        {onClose && <button onClick={onClose} className="text-ink-muted hover:text-ink ml-2">×</button>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = 'Konfirmasi', destructive = false }: { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; confirmText?: string; destructive?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Card className="max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
        <p className="text-ink-muted text-sm mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button className="btn btn-secondary" onClick={onCancel}>Batal</button>
          <button className={clsx('btn', destructive ? 'btn-danger' : 'btn-primary')} onClick={onConfirm}>{confirmText}</button>
        </div>
      </Card>
    </div>
  );
}

export interface PolicyModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Label tombol primer di footer. Default: "Saya Mengerti". */
  primaryLabel?: string;
}

export function PolicyModal({ open, title, onClose, children, primaryLabel = 'Saya Mengerti' }: PolicyModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog for accessibility.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-modal-title"
        tabIndex={-1}
        className="bg-bg-card border border-line rounded-card shadow-soft w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-line shrink-0">
          <h2 id="policy-modal-title" className="text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-ink-muted hover:text-ink p-1 -m-1 rounded focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <span aria-hidden="true" className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="p-5 overflow-y-auto text-sm text-ink-muted space-y-3 leading-relaxed">
          {children}
        </div>
        <div className="p-4 border-t border-line flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

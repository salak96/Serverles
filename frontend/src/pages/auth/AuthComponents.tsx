import { useId, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react';

export function BrandLogo() {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="w-11 h-11 rounded-[11px] bg-accent text-bg flex items-center justify-center font-extrabold text-xl" aria-hidden="true">P</div>
      <div className="text-left">
        <div className="text-[17px] font-bold tracking-tight text-ink leading-tight">PawangTools</div>
        <div className="text-xs text-ink-muted mt-0.5">Membership &amp; License Portal</div>
      </div>
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="relative min-h-screen min-h-[100dvh] bg-[#0B0B0B] text-ink flex flex-col items-center justify-center px-4 py-8 sm:py-12 overflow-hidden">
      {/* Subtle modern background grid pattern */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
        }}
        aria-hidden="true"
      />
      {/* Decorative ambient radial glow */}
      <div
        className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-[#D4AF37]/10 via-[#FF8A00]/5 to-transparent blur-3xl rounded-full"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-[440px]">
        <header className="mb-7">
          <BrandLogo />
        </header>
        <section className="bg-bg-card border border-line rounded-2xl px-5 py-7 sm:p-8 shadow-soft">
          <h1 className="text-[22px] sm:text-2xl leading-tight font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="text-sm leading-relaxed text-ink-muted mt-2 mb-7">{subtitle}</p> : <div className="mb-6" />}
          {children}
        </section>
      </div>
    </main>
  );
}

type FormInputProps = ComponentProps<'input'> & { label: string; error?: string; hint?: ReactNode; labelAction?: ReactNode };

export function FormInput({ label, error, hint, labelAction, id, className, ...props }: FormInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper inputId={inputId} label={label} error={error} hint={hint} labelAction={labelAction}>
      <input
        id={inputId}
        className={clsx('input', error && '!border-danger/70 focus:!ring-danger/40', className)}
        aria-invalid={!!error}
        aria-describedby={describedBy(inputId, error, hint)}
        {...props}
      />
    </FieldWrapper>
  );
}

export function PasswordInput({ label, error, hint, labelAction, id, ...props }: Omit<FormInputProps, 'type'>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <FieldWrapper inputId={inputId} label={label} error={error} hint={hint} labelAction={labelAction}>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={clsx('input pr-12', error && '!border-danger/70 focus:!ring-danger/40')}
          aria-invalid={!!error}
          aria-describedby={describedBy(inputId, error, hint)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-line/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
          aria-label={visible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </div>
    </FieldWrapper>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode): string | undefined {
  const ids = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

function FieldWrapper({ inputId, label, error, hint, labelAction, children }: { inputId: string; label: string; error?: string; hint?: ReactNode; labelAction?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor={inputId} className="text-sm font-medium text-ink/90">{label}</label>
        {labelAction}
      </div>
      {children}
      {error && <FormError id={`${inputId}-error`}>{error}</FormError>}
      {hint && <div id={`${inputId}-hint`} className="mt-2">{hint}</div>}
    </div>
  );
}

export function FormError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs text-danger mt-1.5">
      <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function FormAlert({ variant = 'danger', children }: { variant?: 'danger' | 'success' | 'warning'; children: ReactNode }) {
  const styles = {
    danger: 'bg-danger/10 border-danger/30 text-red-300',
    success: 'bg-success/10 border-success/30 text-emerald-300',
    warning: 'bg-warning/10 border-warning/30 text-amber-300',
  } as const;
  const Icon = variant === 'success' ? CheckCircle2 : variant === 'warning' ? Info : AlertCircle;
  return (
    <div role={variant === 'danger' ? 'alert' : 'status'} className={clsx('flex items-start gap-2.5 border rounded-[10px] px-3.5 py-3 text-sm leading-relaxed text-left', styles[variant])}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function PrimaryButton({ loading, loadingText, children, className, disabled, type = 'submit', ...props }: ComponentProps<'button'> & { loading?: boolean; loadingText?: string }) {
  return (
    <button
      type={type}
      className={clsx('btn btn-primary w-full h-12 text-[15px] font-semibold rounded-[10px] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 rounded-full border-2 border-bg/30 border-t-bg animate-spin" aria-hidden="true" />
          {loadingText ?? 'Memproses...'}
        </>
      ) : children}
    </button>
  );
}

export function AuthFooter({ text, linkText, to }: { text: string; linkText: string; to: string }) {
  return (
    <p className="text-center text-sm text-ink-muted pt-5 mt-1 border-t border-line/70">
      {text}{' '}
      <Link to={to} className="font-semibold text-accent hover:text-accent-hover focus:outline-none focus-visible:underline">{linkText}</Link>
    </p>
  );
}

export function StatusIcon({ children }: { children: ReactNode }) {
  return (
    <div className="w-14 h-14 mx-auto rounded-full bg-accent/15 text-accent flex items-center justify-center">{children}</div>
  );
}

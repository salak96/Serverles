import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui';
import { formatJakarta } from '@/lib/format';
import type { Plan } from '@/types';

interface OrderPreview {
  order: { id: string; amount: number; amountFormatted: string; currency: string; status: string; provider: string; durationDays: number; expiresAt: string; plan: { name: string; slug: string } };
  payment: { provider: string; configured: boolean; message: string };
}

export function SubscriptionsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<{ planId: string; durationDays: number } | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<OrderPreview | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [serverMessage, setServerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!paymentOrder) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paymentOrder]);

  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/plans') });
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api<Array<OrderPreview['order'] & { amountFormatted: string }>>('/subscriptions/orders') });

  const checkout = useMutation({
    mutationFn: () => api<OrderPreview>('/subscriptions/checkout', { method: 'POST', body: selected }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      setServerMessage(null);
      setSelected(null);
      setSecondsLeft(15 * 60);
      setPaymentOrder(res);
    },
    onError: (e) => setServerMessage({ type: 'error', text: e instanceof HttpError ? e.message : 'Gagal membuat order.' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Pilih paket</h2>
        <p className="text-sm text-ink-muted mt-1">Harga dan durasi dapat berubah sewaktu-waktu sesuai konfigurasi admin.</p>
      </div>

      {serverMessage && (
        <div className={`text-sm rounded-lg px-3 py-2 border ${serverMessage.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
          {serverMessage.text}
          <button className="ml-3 text-ink-muted hover:text-ink" onClick={() => setServerMessage(null)}>×</button>
        </div>
      )}

      {plans.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-80" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.data?.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSelect={(durationDays) => setSelected({ planId: plan.id, durationDays })}
              selected={selected}
            />
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-md w-full">
            <h3 className="font-semibold text-lg mb-2">Konfirmasi order</h3>
            <p className="text-sm text-ink-muted mb-4">
              Anda akan membuat order untuk paket ini. Order berstatus <strong>PENDING</strong> hingga
              pembayaran terverifikasi.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Batal</button>
              <button
                className="btn btn-primary"
                onClick={() => checkout.mutate()}
                disabled={checkout.isPending}
              >
                {checkout.isPending ? 'Membuat order...' : 'Buat order'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          secondsLeft={secondsLeft}
          onClose={() => setPaymentOrder(null)}
        />
      )}

      <div>
        <h3 className="font-semibold mb-3">Riwayat order</h3>
        {orders.isLoading ? <Skeleton className="h-24" /> :
          !orders.data || orders.data.length === 0 ? (
            <EmptyState title="Belum ada order" message="Order Anda akan muncul di sini setelah memilih paket." />
          ) : (
            <Card className="!p-0 overflow-hidden">
              <ul className="divide-y divide-line">
                {orders.data.map((o) => (
                  <li key={o.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{o.plan?.name ?? 'Paket'}</div>
                      <div className="text-xs text-ink-muted">
                        {o.durationDays} hari · {formatJakarta(o.expiresAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{o.amountFormatted}</div>
                      <Badge variant={o.status === 'PAID' ? 'success' : o.status === 'PENDING' ? 'warning' : 'muted'}>{o.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
      </div>
    </div>
  );
}

function PaymentModal({ order, secondsLeft, onClose }: { order: OrderPreview; secondsLeft: number; onClose: () => void }) {
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');
  const expired = secondsLeft === 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Pembayaran QRIS</h3>
          <button className="text-xl text-ink-muted hover:text-ink" onClick={onClose}>×</button>
        </div>
        <div className="rounded-lg bg-warning/10 border border-warning/30 text-warning p-3 text-center mb-4">
          <div className="text-xs uppercase tracking-wide">Selesaikan pembayaran dalam</div>
          <div className="font-mono text-2xl font-bold">{minutes}:{seconds}</div>
        </div>
        <div className="text-center">
          <img src="/assets/payment.jpeg" alt="QRIS PawangTools" className="w-full max-w-xs mx-auto rounded-lg border border-line" />
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">Order</span><span className="font-mono">{order.order.id}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">Paket</span><span>{order.order.plan.name}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>{order.order.amountFormatted}</span></div>
        </div>
        <p className="text-xs text-ink-muted mt-4 text-center">Setelah pembayaran, status order akan berubah setelah pembayaran diverifikasi. Jangan menutup modal sebelum menyelesaikan pembayaran.</p>
        {expired && <p className="text-sm text-danger text-center mt-3">Waktu pembayaran telah habis. Buat order baru jika diperlukan.</p>}
        <button className="btn btn-secondary w-full mt-4" onClick={onClose}>Tutup</button>
      </Card>
    </div>
  );
}

function PlanCard({ plan, onSelect, selected }: { plan: Plan; onSelect: (d: number) => void; selected: { planId: string; durationDays: number } | null }) {
  const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
  const isSelected = selected?.planId === plan.id;
  return (
    <Card className={`flex flex-col gap-3 ${isSelected ? 'border-accent' : ''}`}>
      <div>
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-lg">{plan.name}</h4>
          {plan.slug === 'pro' && <Badge variant="accent">Populer</Badge>}
        </div>
        <p className="text-xs text-ink-muted mt-1 min-h-[2.5rem]">{plan.description}</p>
      </div>
      <div>
        <div className="text-2xl font-bold">{plan.priceFormatted}</div>
        <div className="text-xs text-ink-muted">/ {plan.durationDays} hari · maks {plan.maxDevices} perangkat</div>
      </div>
      <ul className="text-sm space-y-1.5 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-success shrink-0 mt-0.5" /> <span>{f}</span>
          </li>
        ))}
      </ul>
      <button className="btn btn-primary w-full" onClick={() => onSelect(plan.durationDays)}>
        Pilih paket
      </button>
    </Card>
  );
}

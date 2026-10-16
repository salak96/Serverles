import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold mb-2">Halaman tidak ditemukan</h1>
        <p className="text-ink-muted text-sm mb-6">Tautan yang Anda buka tidak tersedia atau telah dipindahkan.</p>
        <Link to="/dashboard" className="btn btn-primary">Kembali ke dashboard</Link>
      </Card>
    </div>
  );
}
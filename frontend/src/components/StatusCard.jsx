import { Loader2, QrCode, Smartphone, Wifi, WifiOff } from 'lucide-react';

const STATUS = {
  connected: { label: 'Connected', icon: Wifi, color: 'text-emerald-400', ring: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  qr: { label: 'Scan QR Code', icon: QrCode, color: 'text-amber-400', ring: 'bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400 animate-pulse' },
  connecting: { label: 'Connecting…', icon: Loader2, color: 'text-sky-400', ring: 'bg-sky-500/10 border-sky-500/30', dot: 'bg-sky-400 animate-pulse', spin: true },
  disconnecting: { label: 'Disconnecting…', icon: Loader2, color: 'text-orange-400', ring: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-400 animate-pulse', spin: true },
  disconnected: { label: 'Disconnected', icon: WifiOff, color: 'text-rose-400', ring: 'bg-rose-500/10 border-rose-500/30', dot: 'bg-rose-400' },
};

export default function StatusCard({ bot, linked }) {
  const meta = STATUS[bot.status] ?? STATUS.disconnected;
  const Icon = meta.icon;
  const number = bot.user?.id?.split(':')[0]?.split('@')[0];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Connection status</h2>

      <div className={`flex items-center gap-4 rounded-xl border p-4 ${meta.ring}`}>
        <Icon size={28} className={`${meta.color} ${meta.spin ? 'animate-spin' : ''}`} />
        <div>
          <p className={`text-lg font-semibold ${meta.color}`}>{meta.label}</p>
          {bot.reason && bot.status === 'disconnected' && <p className="text-xs text-slate-400">{bot.reason}</p>}
        </div>
        <span className={`ml-auto h-2.5 w-2.5 rounded-full ${meta.dot}`} />
      </div>

      {bot.status === 'connected' && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-950/60 p-3 text-sm">
          <Smartphone size={18} className="text-slate-400" />
          <div>
            <p className="font-medium text-white">{bot.user?.name || 'WhatsApp account'}</p>
            {number && <p className="text-xs text-slate-400">+{number}</p>}
          </div>
        </div>
      )}

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${linked ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        Dashboard link: {linked ? 'live' : 'reconnecting…'}
      </p>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, MessageSquare, Zap } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');

function formatUptime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${d ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className={`mb-2 inline-flex rounded-lg p-2 ${tone}`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function StatsCards({ stats, startedAt }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Clock} label="Server uptime" value={formatUptime(now - (stats?.startedAt ?? startedAt))} tone="bg-sky-500/10 text-sky-400" />
        <Stat icon={MessageSquare} label="Messages received" value={stats?.messagesReceived ?? 0} tone="bg-violet-500/10 text-violet-400" />
        <Stat icon={Zap} label="Commands executed" value={stats?.commandsExecuted ?? 0} tone="bg-emerald-500/10 text-emerald-400" />
        <Stat icon={AlertTriangle} label="Errors" value={stats?.errors ?? 0} tone="bg-rose-500/10 text-rose-400" />
      </div>

      {stats?.topCommands?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-500">Top commands:</span>
          {stats.topCommands.map((c) => (
            <span key={c.name} className="rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-1">
              .{c.name} <span className="text-emerald-400">×{c.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

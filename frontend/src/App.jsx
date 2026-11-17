import { Bot } from 'lucide-react';
import { useBotSocket } from './hooks/useBotSocket.js';
import Login from './components/Login.jsx';
import StatusCard from './components/StatusCard.jsx';
import QRCard from './components/QRCard.jsx';
import Controls from './components/Controls.jsx';
import StatsCards from './components/StatsCards.jsx';
import LogsTerminal from './components/LogsTerminal.jsx';

export default function App() {
  const { bot, stats, logs, linked, needsAuth, login, callApi, clearLogs } = useBotSocket();

  if (needsAuth) return <Login onSubmit={login} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">WhatsApp Bot Dashboard</h1>
          <p className="text-sm text-slate-500">Monitor, pair and control your bot in real time</p>
        </div>
      </header>

      <StatsCards stats={stats} startedAt={bot.startedAt} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <StatusCard bot={bot} linked={linked} />
          <Controls bot={bot} onAction={callApi} />
        </div>
        <div className="lg:col-span-2">
          <QRCard bot={bot} busy={false} onConnect={() => callApi('/api/start')} />
        </div>
      </div>

      <LogsTerminal logs={logs} onClear={clearLogs} />
    </div>
  );
}

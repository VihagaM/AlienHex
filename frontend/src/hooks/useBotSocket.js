import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

const MAX_LOGS = 300;
const TOKEN_KEY = 'wa-dashboard-token';

export function useBotSocket() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [linked, setLinked] = useState(false); // dashboard <-> backend socket
  const [bot, setBot] = useState({ status: 'disconnected', qr: null, user: null, reason: null, startedAt: Date.now() });
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    const socket = io(API_URL, { auth: { token }, reconnectionDelayMax: 5000 });

    socket.on('connect', () => {
      setLinked(true);
      setNeedsAuth(false);
    });
    socket.on('disconnect', () => setLinked(false));
    socket.on('connect_error', (err) => {
      setLinked(false);
      if (err.message === 'unauthorized') {
        setNeedsAuth(true);
        socket.disconnect(); // stop retrying until a new token is entered
      }
    });

    socket.on('state', setBot);
    socket.on('stats', setStats);
    socket.on('logs', (history) => setLogs(history.slice(-MAX_LOGS)));
    socket.on('log', (entry) => setLogs((prev) => [...prev, entry].slice(-MAX_LOGS)));

    return () => socket.disconnect();
  }, [token]);

  const login = useCallback((value) => {
    sessionStorage.setItem(TOKEN_KEY, value);
    setToken(value);
  }, []);

  const callApi = useCallback(async (path) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { bot, stats, logs, linked, needsAuth, login, callApi, clearLogs };
}

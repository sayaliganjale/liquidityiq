import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";

const WS_URL = `${API.replace(/^http/, "ws")}/ws/prices`;

/**
 * Streams live quotes over a WebSocket, falling back to REST polling if the socket
 * cannot be established. Returns { quotes, live } where quotes is keyed by symbol.
 */
export default function usePriceStream(symbols = []) {
  const [quotes, setQuotes] = useState({});
  const [live, setLive] = useState(false);
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const pollRef = useRef(null);
  const key = symbols.join(",");

  useEffect(() => {
    if (!key) {
      setQuotes({});
      return;
    }
    let closed = false;

    const startPolling = () => {
      if (pollRef.current) return;
      const tick = async () => {
        try {
          const list = key.split(",");
          const res = await Promise.all(
            list.map((s) =>
              fetch(`${API}/market/quote/${encodeURIComponent(s)}`, { credentials: "include" })
                .then((r) => r.json())
                .catch(() => null)
            )
          );
          if (closed) return;
          setQuotes((prev) => {
            const next = { ...prev };
            res.forEach((q) => q?.symbol && (next[q.symbol] = q));
            return next;
          });
        } catch {}
      };
      tick();
      pollRef.current = setInterval(tick, 15000);
    };

    const connect = () => {
      if (closed) return;
      let ws;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        startPolling();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setLive(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        ws.send(JSON.stringify({ symbols: key.split(",") }));
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type !== "tick") return;
          setQuotes((prev) => {
            const next = { ...prev };
            msg.quotes.forEach((q) => {
              if (q.symbol) next[q.symbol] = q;
            });
            return next;
          });
        } catch {}
      };

      ws.onerror = () => setLive(false);

      ws.onclose = () => {
        setLive(false);
        if (closed) return;
        retryRef.current += 1;
        if (retryRef.current <= 3) {
          setTimeout(connect, 1200 * retryRef.current);
        } else {
          startPolling();
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, [key]);

  // Push subscription updates on an already-open socket
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1 && key) {
      ws.send(JSON.stringify({ symbols: key.split(",") }));
    }
  }, [key]);

  return { quotes, live };
}

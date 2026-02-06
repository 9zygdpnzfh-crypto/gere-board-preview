import { useEffect, useState } from 'react';

export type MotionPayload = {
  type: string;
  status?: string;
  color?: string;
  sound?: string;
  motion?: string;
  timestamp?: number;
};

export function useWebSocket(url: string) {
  const [message, setMessage] = useState<MotionPayload | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WS connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessage(data);
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    ws.onclose = () => {
      console.log('WS disconnected');
      setConnected(false);
    };

    return () => ws.close();
  }, [url]);

  return { message, connected };
}


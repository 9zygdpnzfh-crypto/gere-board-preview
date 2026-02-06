import { useEffect, useState } from 'react';

export type CurrencyRate = {
  base: string;
  target_currency: string;
  rate: number;
  timestamp: number;
};

export function useCurrencySocket() {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      console.log('Currency WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'currency_update') {
          setRates(msg.payload);
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    ws.onclose = () => {
      console.log('Currency WebSocket disconnected');
      setConnected(false);
    };

    return () => ws.close();
  }, []);

  return { rates, connected };
}


import { useEffect, useState } from 'react';

function CurrencyDisplay() {
  const [status, setStatus] = useState('processing');
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080');

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Expecting: { type: "currency_update", payload: {...} }
        if (message.type === 'currency_update') {
          setStatus('ready');
          setPayload(message.payload);
        }
      } catch (err) {
        console.error('Bad WebSocket message:', err);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => socket.close();
  }, []);

  // UI states
  if (status === 'processing') {
    return (
      <div
        style={{
          backgroundColor: '#6a0dad', // purple
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          color: 'white'
        }}
      >
        Processing…
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#008000', // green
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        color: 'white'
      }}
    >
      {payload ? JSON.stringify(payload) : 'No data'}
    </div>
  );
}

export default CurrencyDisplay;


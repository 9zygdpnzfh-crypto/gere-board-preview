import { useCurrencySocket } from '../ws/useCurrencySocket';

export default function CurrencyBoard() {
  const { rates, connected } = useCurrencySocket();

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: '#4b6cff' }}>
        Live Exchange Rates {connected ? '●' : '○'}
      </h2>

      <div style={{ marginTop: 16 }}>
        {rates.map((r) => (
          <div
            key={`${r.base}-${r.target_currency}`}
            style={{
              padding: '12px 16px',
              marginBottom: 8,
              borderRadius: 8,
              background: '#0f172a',
              color: '#e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              transition: 'background-color 0.3s ease'
            }}
          >
            <span>{r.base} → {r.target_currency}</span>
            <strong>{r.rate.toFixed(4)}</strong>
          </div>
        ))}

        {rates.length === 0 && (
          <div style={{ opacity: 0.6 }}>
            Waiting for exchange data…
          </div>
        )}
      </div>
    </div>
  );
}


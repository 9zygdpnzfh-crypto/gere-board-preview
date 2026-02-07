import { useWebSocket } from './hooks/useWebSocket';
import { motionStyles } from './sensory/motionMap';
import CurrencyBoard from './components/CurrencyBoard';

function App() {
  const { message } = useWebSocket('ws://localhost:8080');

  const style = {
    minHeight: '100vh',
    background: '#020617',
    ...(message?.motion ? motionStyles[message.motion] || {} : {})
  };

  return (
    <div style={style}>
      <CurrencyBoard />
    </div>
  );
}

export default App;





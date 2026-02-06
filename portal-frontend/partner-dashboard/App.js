import React from 'react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="App">
      <Dashboard sectorId={1} />
    </div>
  );
}

export default App;
import React, { useState, useEffect } from 'react';

const App = () => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080'); // Connect to 
WebSocket server

    socket.onopen = () => {
      console.log('WebSocket connection established');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessage(data.event); // Update message in real-time
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="App">
      <h1>Real-Time Dashboard</h1>
      <p>Latest Event: {message}</p>
    </div>
  );
};

export default App;

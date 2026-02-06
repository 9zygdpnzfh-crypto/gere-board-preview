import React, { useState, useEffect } from 'react';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080');
    
    socket.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      setNotifications((prevNotifications) => [...prevNotifications, 
notification]);
    };

    return () => socket.close();
  }, []);

  return (
    <div>
      <h3>Notifications</h3>
      {notifications.map((notification, index) => (
        <div key={index}>{notification.type}: 
{JSON.stringify(notification.data)}</div>
      ))}
    </div>
  );
};

export default Notifications;

import React, { useState } from 'react';

const FetchDataComponent = () => {
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const response = await fetch('/data');
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      // handle data...
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <button onClick={fetchData}>Fetch Data</button>
      {error && <p>Error: {error}</p>}
    </div>
  );
};

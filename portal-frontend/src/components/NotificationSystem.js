import React, { useState, useEffect } from 'react';

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);


function playQuotaSound() {
  const audio = new Audio('/sounds/soft-confirm.mp3');
  audio.volume = 0.25;
  audio.play();
}

  useEffect(() => {
    const eventSource = new EventSource('/notifications'); // Assuming 
backend pushes notifications via SSE

    eventSource.onmessage = (event) => {
      const newNotification = JSON.parse(event.data);

      if (data.status === "confirmed") {
         setQuotaState("safe-active");
          playQuotaSound();
}      
setNotifications((prevNotifications) => [...prevNotifications, 
newNotification]);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div>
      <h3>Notifications</h3>
      <ul>
        {notifications.map((notification, index) => (
          <li key={index}>{notification.message}</li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationSystem;

import React, { useState, useEffect } from 'react';
import './EventVisualizer.css'; // Add CSS for animations

const EventVisualizer = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const response = await fetch('/admin/dashboard/events');
      const data = await response.json();
      setEvents(data);
    };

    fetchEvents();
  }, []);

  return (
    <div className="event-container">
      {events.map((event, index) => (
        <div key={index} className="event-item">
          <div className="event-type">{event.event_type}</div>
          <div className="event-count">{event.event_count}</div>
        </div>
      ))}
    </div>
  );
};

export default EventVisualizer;

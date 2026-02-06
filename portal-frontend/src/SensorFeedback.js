import React, { useState, useEffect } from 'react';

const SensorFeedback = () => {
  const [sensorData, setSensorData] = useState(null);

  useEffect(() => {
    const fetchSensorData = async () => {
      const response = await fetch('/admin/sensor-feedback');
      const data = await response.json();
      setSensorData(data);
    };

    fetchSensorData();
  }, []);

  // Adjust the background color or any other visual feedback based on the 
sensor data
  const getColor = (status) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'pending':
        return 'yellow';
      default:
        return 'red';
    }
  };

  return (
    <div style={{ backgroundColor: getColor(sensorData?.status) }} 
className="sensor-feedback">
      <p>{sensorData?.status}</p>
      {/* Optionally trigger sound or animations based on status */}
    </div>
  );
};

export default SensorFeedback;

import React, { useState, useEffect } from 'react';

const Dashboard = ({ sectorId }) => {
  const [sectorData, setSectorData] = useState(null);
  const [events, setEvents] = useState([]);

  // Fetch sector data and events for the partner dashboard
  useEffect(() => {
    const fetchData = async () => {
      try {
        const sectorResponse = await 
fetch(`/admin/dashboard/sector/${sectorId}`);
        const sectorData = await sectorResponse.json();

        const eventResponse = await fetch(`/admin/dashboard/events`);
        const eventData = await eventResponse.json();

        setSectorData(sectorData);
        setEvents(eventData);
      } catch (error) {
        console.error('Error fetching sector data:', error);
      }
    };

    fetchData();
  }, [sectorId]);

  if (!sectorData) return <div>Loading...</div>;

  return (
    <div>
      <h2>Partner Dashboard - Sector {sectorId}</h2>
      <div>
        <p>Total Organizations: {sectorData.totalOrganizations}</p>
        <p>Total Quota: {sectorData.totalQuota}</p>
      </div>

      <h3>Recent Events</h3>
      <ul>
        {events.map((event, index) => (
          <li key={index}>{event.event_type}: {event.event_count}</li>
        ))}
      </ul>
    </div>
  );
};

const ExportButton = () => {
  const handleExport = async () => {
    const response = await fetch('/admin/export-events');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'events-report.csv');
    document.body.appendChild(link);
    link.click();
  };

  return (
    <button onClick={handleExport}>
      Export Event Data
    </button>
  );
};

export default ExportButton;

import React, { useState, useEffect } from 'react';

const SectorDashboard = ({ sectorId }) => {
  const [sectorData, setSectorData] = useState(null);

  useEffect(() => {
    const fetchSectorData = async () => {
      const response = await fetch(`/admin/dashboard/sector/${sectorId}`);
      const data = await response.json();
      setSectorData(data);
    };

    fetchSectorData();
  }, [sectorId]);

  if (!sectorData) return <div>Loading...</div>;

  return (
    <div>
      <h2>Sector Dashboard</h2>
      <p>Total Organizations: {sectorData.totalOrganizations}</p>
      <p>Total Quota: {sectorData.totalQuota}</p>
    </div>
  );
};

export default SectorDashboard;

async function fetchDashboardData(sectorId) {
  const response = await fetch(`/admin/dashboard/sector/${sectorId}`);
  const data = await response.json();

  const dashboard = document.getElementById('sector-dashboard');
  dashboard.innerHTML = `
    <h2>Dashboard for Sector ${sectorId}</h2>
    <p>Total Organizations: ${data.sectorData.total_organizations}</p>
    <p>Total Quota: ${data.sectorData.total_quota}</p>
    <h3>Event Breakdown:</h3>
    <ul>
      ${data.eventData.map(event => `
        <li>${event.event_type}: ${event.event_count}</li>
      `).join('')}
    </ul>
  `;
}

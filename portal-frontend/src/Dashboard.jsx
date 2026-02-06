const ExportButton = () => {
  const handleExport = async () => {
    const response = await fetch('/admin/export-quotas');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'quota-report.csv');
    document.body.appendChild(link);
    link.click();
  };

  return <button onClick={handleExport}>Export Quota Data</button>;
};

export default ExportButton;
import React, { useState, useEffect } from 'react';

const PartnerDashboard = ({ sectorId }) => {
  const [partnerData, setPartnerData] = useState(null);

  useEffect(() => {
    const fetchPartnerData = async () => {
      const response = await 
fetch(`/admin/partner-dashboard/${sectorId}`);
      const data = await response.json();
      setPartnerData(data);
    };

    fetchPartnerData();
  }, [sectorId]);

  if (!partnerData) return <div>Loading...</div>;

  return (
    <div>
      <h2>Partner Dashboard</h2>
      <p>Total Organizations: {partnerData.totalOrganizations}</p>
      <p>Total Quota: {partnerData.totalQuota}</p>
      <p>Total Beneficiaries: {partnerData.totalBeneficiaries}</p>
    </div>
  );
};

export default PartnerDashboard;

const ExportButton = () => {
  const handleExport = async () => {
    const startDate = '2022-01-01'; // For example
    const endDate = '2022-12-31';
    const sectorId = 1; // Example sector ID

    const response = await 
fetch(`/admin/export-quotas?startDate=${startDate}&endDate=${endDate}&sectorId=${sectorId}`);
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

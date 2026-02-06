import React, { useState, useEffect } from 'react';

const LazyLoadData = () => {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);

  const fetchData = async () => {
    const response = await fetch(`/data?page=${page}`);
    const newData = await response.json();
    setData((prevData) => [...prevData, ...newData]);
    setPage((prevPage) => prevPage + 1);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      {data.map((item, index) => (
        <div key={index}>{item.name}</div>
      ))}
      <button onClick={fetchData}>Load More</button>
    </div>
  );
};

export default LazyLoadData;

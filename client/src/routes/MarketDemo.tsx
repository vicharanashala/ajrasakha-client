import React from 'react';
import MarketChart from '~/components/Chat/Messages/Content/MarketChart';

const MarketDemo = () => {
  const mockData = [
    { date: '2024-03-17', price: 2100 },
    { date: '2024-03-18', price: 2150 },
    { date: '2024-03-19', price: 2120 },
    { date: '2024-03-20', price: 2180 },
    { date: '2024-03-21', price: 2210 },
    { date: '2024-03-22', price: 2200 },
    { date: '2024-03-23', price: 2250 }
  ];

  return (
    <div className="min-h-screen bg-surface-primary p-4 md:p-10 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2">AjraSakha Market Visualizer</h1>
          <p className="text-text-secondary">Feature Demo (No API Key Required)</p>
        </div>
        
        <div className="bg-surface-secondary p-6 rounded-3xl border border-border-light shadow-xl">
          <p className="mb-6 text-sm text-text-primary italic">
            "Below is a demonstration of how crop price trends are visualized for farmers. 
            In the live chat, this appears automatically when market data is fetched."
          </p>
          
          <MarketChart 
            data={mockData} 
            crop="Wheat" 
            market="Mumbai Mandi" 
            unit="₹/Quintal"
          />
        </div>

        <div className="text-sm text-text-secondary text-center">
          <p>Go back to <a href="/login" className="text-green-600 font-medium underline">Login</a> to try the chatbot (requires API keys).</p>
        </div>
      </div>
    </div>
  );
};

export default MarketDemo;

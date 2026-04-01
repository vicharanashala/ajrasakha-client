import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, Calendar, IndianRupee } from 'lucide-react';

interface PriceData {
  date: string;
  price: number;
}

interface MarketChartProps {
  data: PriceData[];
  crop?: string;
  market?: string;
  unit?: string;
}

const MarketChart: React.FC<MarketChartProps> = ({ 
  data, 
  crop = 'Crop', 
  market = 'Local Market',
  unit = '₹/Quintal'
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-surface-secondary rounded-xl border border-border-light">
        <p className="text-text-secondary text-sm">No price data available for visualization.</p>
      </div>
    );
  }

  return (
    <div className="my-4 w-full overflow-hidden rounded-2xl border border-border-medium bg-surface-primary shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Header */}
      <div className="bg-surface-secondary px-4 py-3 border-b border-border-light flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <TrendingUp size={18} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary capitalize">{crop} Price Trend</h3>
            <p className="text-xs text-text-secondary flex items-center gap-1">
              <Calendar size={12} /> {market}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full border border-green-100 dark:border-green-800">
            Last 7 Days
          </span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[240px] w-full p-4 pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b' }}
              tickFormatter={(str) => {
                const date = new Date(str);
                return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
              }}
            />
            <YAxis 
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b' }}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}
              itemStyle={{ fontSize: '12px', color: '#10b981' }}
              formatter={(value: number) => [`${value} ${unit}`, 'Price']}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#10b981" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-surface-secondary/50 text-[10px] text-text-secondary flex justify-between items-center border-t border-border-light">
        <span className="flex items-center gap-1 italic">
          * Data fetched from AGMARKNET via Market MCP
        </span>
        <span className="font-medium text-text-primary flex items-center gap-0.5">
          <IndianRupee size={10} /> {unit}
        </span>
      </div>
    </div>
  );
};

export default MarketChart;

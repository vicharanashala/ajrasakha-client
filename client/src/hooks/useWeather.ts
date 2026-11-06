import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Current weather returned by the /api/weather endpoint.
export interface Weather {
  liveTemperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  weatherCondition: string;
  feelsLikeTemperature: number;
}

// How long weather data is treated as fresh before it is fetched again.
const WEATHER_STALE_TIME = 10 * 60 * 1000;

// Fetches the current weather for the signed in user.
const fetchWeather = async (): Promise<Weather> => {
  const { data } = await axios.get<Weather>('/api/weather');
  return data;
};

// Provides the current weather with caching so the header does not refetch on every render.
export const useWeather = (enabled = true) => {
  return useQuery({
    queryKey: ['weather', 'current'],
    queryFn: fetchWeather,
    staleTime: WEATHER_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled,
  });
};

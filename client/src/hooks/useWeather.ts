import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Current weather returned by the /api/weather endpoint. Readings the station did not report are null.
export interface Weather {
  liveTemperature: number;
  humidity: number | null;
  rainfall: number | null;
  windSpeed: number | null;
  weatherCondition: string;
  feelsLikeTemperature: number | null;
  source: string | null;
  stationName: string | null;
  stationDistanceKm: number | null;
  // When the station recorded the reading, already formatted by the service, e.g. "06 Nov 2026, 10:30 AM IST".
  recordedAt: string | null;
}

// How long weather data is treated as fresh before it is fetched again.
const WEATHER_STALE_TIME = 10 * 60 * 1000;
// Attempts made after a failed request before showing the error state.
const WEATHER_MAX_RETRIES = 2;

// True when the server answered that the farmer has no saved location, which retrying cannot fix.
export const isMissingLocationError = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 404;

// Fetches the current weather for the signed in user.
const fetchWeather = async (): Promise<Weather> => {
  const { data } = await axios.get<Weather>('/api/weather');
  return data;
};

// Provides the current weather with caching so the page does not refetch on every render.
export const useWeather = (enabled = true) => {
  return useQuery({
    queryKey: ['weather', 'current'],
    queryFn: fetchWeather,
    staleTime: WEATHER_STALE_TIME,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !isMissingLocationError(error) && failureCount < WEATHER_MAX_RETRIES,
    enabled,
  });
};

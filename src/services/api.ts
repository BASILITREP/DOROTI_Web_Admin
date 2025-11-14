import type { FieldEngineer,  ActivityHistory } from '../types';
import image from '../assets/windowsyarn.jpg';

// Use environment variable for API URL with fallback
const API_URL = import.meta.env.VITE_DB_URL || 'http://localhost:5242/api';

// Define error handler
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const text = await response.text();
    console.error('API Error:', response.status, text);
    throw new Error(text || `Error: ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  
  return null;
};



export const fetchFieldEngineers = async (): Promise<FieldEngineer[]> => {
  // Fixed URL to match controller name
  const response = await fetch(`${API_URL}/FieldEngineer`);
  const data = await handleResponse(response);
  
  // Transform the data to match the frontend expected structure
  return data.map((fe: any) => ({
    id: fe.id,
    name: fe.name,
    lng: fe.currentLongitude || 0,
    lat: fe.currentLatitude || 0,
    status: fe.status || 'Active',
    lastUpdated: fe.updatedAt || new Date().toISOString(),
    currentAddress: fe.currentAddress || 'Unknown',
    timeIn: fe.timeIn || null,
  }));
};






export const loginUser = async (email: string, password: string) => {
  const response = await fetch(`${API_URL}/FieldEngineer/webadmin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Login failed");
  }

  return response.json();
};

export const isAuthenticated = () => {
  return localStorage.getItem("token") !== null;
};

export const getAuthToken = () => {
  return localStorage.getItem("token");
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
};

export const startFieldEngineerNavigation = async (
  fieldEngineerId: number,
  fieldEngineerName: string,
  routeCoordinates: number[][]
) => {
  const response = await fetch(`${API_URL}/Test/startNavigation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fieldEngineerId,
      fieldEngineerName,
      routeCoordinates
    }),
  });
  
  return await handleResponse(response);
};

export const stopFieldEngineerNavigation = async (fieldEngineerId: number) => {
  const response = await fetch(`${API_URL}/Test/stopNavigation/${fieldEngineerId}`, {
    method: 'POST',
  });
  
  return await handleResponse(response);
};

export const fetchActivityHistory = async (
  fieldEngineerId: number,
  minStayMinutes?: number,
  startDate?: string,
  endDate?: string
): Promise<ActivityHistory[]> => {
  try {
    const params = new URLSearchParams();
    
    if (minStayMinutes && minStayMinutes > 0) {
      params.append('minStayMinutes', minStayMinutes.toString());
    }
    
    if (startDate) {
      params.append('startDate', startDate);
    }
    if (endDate) {
      params.append('endDate', endDate);
    }
    
    const url = `${API_URL}/FieldEngineer/${fieldEngineerId}/history${
      params.toString() ? '?' + params.toString() : ''
    }`;
    
    console.log('📅 Fetching activity history with params:', {
      fieldEngineerId,
      minStayMinutes,
      startDate,
      endDate,
      url
    });
    
    const response = await fetch(url);
    const data = await handleResponse(response);
   
    console.log(`✅ Received ${data.length} events from backend`);

    // Transform the backend data to match the frontend component's expected structure
    return data.map((event: any) => {
      // ✅ Ensure proper UTC to PH time conversion
      const startTime = event.startTime ? new Date(event.startTime + 'Z') : new Date();
      const endTime = event.endTime ? new Date(event.endTime + 'Z') : new Date();

      const startLocal = startTime.toLocaleString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });

      const endLocal = endTime.toLocaleString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });

      if (event.type === 1) { // Drive
        return {
          id: event.id,
          feId: event.fieldEngineerId,
          type: 'drive',
          distance: `${event.distanceKm?.toFixed(1) || 0} km`,
          timeRange: `${startLocal} - ${endLocal}`,
          duration: `${event.durationMinutes || 0} min`,
          topSpeed: `${event.topSpeedKmh?.toFixed(0) || 0} km/h`,
          riskyEvents: 0,
          mapImage: image,
          startLat: event.startLatitude,
          startLng: event.startLongitude,
          startAddress: event.startAddress || 'Unknown',
          endLat: event.endLatitude,
          endLng: event.endLongitude,
          endAddress: event.endAddress || 'Unknown',
          travelTimeCategory: event.travelTimeCategory,
          calculatedFare: event.calculatedFare || 0,
          routePathJson: event.routePathJson,
        };
      } else { // Stop
        return {
          id: event.id,
          feId: event.fieldEngineerId,
          type: 'stop',
          locationName: event.locationName || 'Unknown',
          address: event.address || 'Unknown location',
          timeRange: `${startLocal} - ${endLocal}`,
          duration: event.durationMinutes || 0,
          mapImage: image,
          lat: event.latitude || event.startLatitude,
          lng: event.longitude || event.startLongitude,
          startLat: event.startLatitude,
          startLng: event.startLongitude,
        };
      }
    });
  } catch (error) {
    console.error('❌ Error fetching activity history:', error);
    throw error;
  }
};

export type RawLocationPoint ={
  fieldEngineerId: number;
  latitude: number;
  longitude: number;
  speed?: number | null;
  timestamp: string;

}

export async function fetchRawPoints(
  feId: number,
  startDate?: string,
  endDate?: string
): Promise<RawLocationPoint[]> {
  const params = new URLSearchParams();
  
  // ✅ Add date range parameters
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  
  const url = `${API_URL}/Location/${feId}${params.toString() ? '?' + params.toString() : ''}`;
  
  console.log('📍 Fetching raw points:', { feId, startDate, endDate, url });
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load raw points: ${res.status}`);
  return res.json();
}







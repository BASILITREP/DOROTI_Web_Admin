
export interface FieldEngineer {
  id: number;
  lng: number;
  lat: number;
  name: string;
  status: string;
  updatedAt: string;
  fcmToken: string;
  currentAddress?: string;
  timeIn?: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}


export interface RouteStep {
  maneuver: string;
  roadName: string;
  distance: string;
}

export interface OngoingRoute {
  id: number;
  feId: number;
  feName: string;
  branchId: number;
  branchName: string;
  startTime: string;
  estimatedArrival: string;
  distance: string;
  duration: string;
  price: string;
  routeSteps?: RouteStep[];
  status: 'in-progress' | 'delayed' | 'arriving';
}

export interface ActivityHistory {
  id: string;
  feId: number;
  type: 'drive' | 'stop';
  distance?: string;
  timeRange: string;
  duration: string;
  topSpeed?: string;
  riskyEvents?: number;
  locationName?: string;
  address?: string;
  //mapImage: string;
  lat?: number;
  lng?: number;
  startLat?: number;
  startLng?: number;
  startAddress?: string;
  endLat?: number;
  endLng?: number;
  endAddress?: string;
  startTime: string;
  endTime: string;
  distanceKm?: number;
  topSpeedKmh?: number;
  travelTimeCategory?: string;
  calculatedFare?: number;
  routePathJson?: string;
  stayBeforeMinutes?: number;
}

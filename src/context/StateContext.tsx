import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActivityHistory, FieldEngineer } from '../types';

interface AppState {
  fieldEngineers: FieldEngineer[];
  setFieldEngineers: React.Dispatch<React.SetStateAction<FieldEngineer[]>>;

  selectedFE: FieldEngineer | null;
  setSelectedFE: (fe: FieldEngineer | null) => void;

  mapCenter: [number, number];
  setMapCenter: (center: [number, number]) => void;

  mapZoom: number;
  setMapZoom: (zoom: number) => void;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  dateRange: {
  startDate: string;
  endDate: string;
};
setDateRange: React.Dispatch<React.SetStateAction<{
  startDate: string;
  endDate: string;
}>>;

stayDurationFilter: number | null;
setStayDurationFilter: React.Dispatch<React.SetStateAction<number | null>>;

selectedActivityId: string | number | null;
setSelectedActivityId: React.Dispatch<React.SetStateAction<string | number | null>>;

historyData: ActivityHistory[];
setHistoryData: React.Dispatch<React.SetStateAction<ActivityHistory[]>>;

}


const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [fieldEngineers, setFieldEngineers] = useState<FieldEngineer[]>([]);
  const [selectedFE, setSelectedFE] = useState<FieldEngineer | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([121.774017, 12.879721]);
  const [mapZoom, setMapZoom] = useState(5.5);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dateRange, setDateRange] = useState({
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
});

const [stayDurationFilter, setStayDurationFilter] = useState<number | null>(null);

const [selectedActivityId, setSelectedActivityId] = useState<string | number | null>(null);

const [historyData, setHistoryData] = useState<ActivityHistory[]>([]);


  return (
    <AppContext.Provider
      value={{
        fieldEngineers,
        setFieldEngineers,
        selectedFE,
        setSelectedFE,
        mapCenter,
        setMapCenter,
        mapZoom,
        setMapZoom,
        sidebarCollapsed,
        setSidebarCollapsed,
        dateRange,
        setDateRange,
        stayDurationFilter,
        setStayDurationFilter,
        selectedActivityId,
        setSelectedActivityId,
        historyData,
        setHistoryData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
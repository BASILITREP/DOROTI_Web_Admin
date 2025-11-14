import * as signalR from '@microsoft/signalr';
import type {  FieldEngineer,  OngoingRoute } from '../types';
import { toast } from 'react-toastify';

// Base API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5242';

// Type for event callbacks
type EventCallback<T> = (data: T) => void;

// Event handler storage
const eventHandlers: { [key: string]: EventCallback<any>[] } = {};

// Persistent SignalR connection instance
let connection: signalR.HubConnection | null = null;

// Initialize and start connection (Singleton)
export const initializeSocket = async (): Promise<void> => {
  // 🛑 Prevent multiple starts (important fix)
  if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
    console.log(`⚡ SignalR already ${connection.state.toLowerCase()}, skipping initialization.`);
    return;
  }

  // Create connection instance if not existing
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/notificationHub`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000]) // 👈 retry schedule
      .configureLogging(signalR.LogLevel.Information)
      .build();

    console.log('Attempting SignalR connection to:', `${API_URL}/notificationHub`);

    // 🔔 Core event listeners
    connection.on('ReceiveFieldEngineerUpdate', (data: FieldEngineer) => {
      notifyEventHandlers('fieldEngineerUpdate', data);
    });

    

  



    connection.on('ReceiveNewRoute', (data: OngoingRoute) => {
      notifyEventHandlers('newRoute', data);
    });

    connection.on('ReceiveRouteUpdate', (data: OngoingRoute) => {
      notifyEventHandlers('routeUpdate', data);
    });

    connection.on('ReceiveNewFieldEngineer', (data: FieldEngineer) => {
      console.log('👷 New field engineer received:', data);
      notifyEventHandlers('newFieldEngineer', data);
    });


    connection.on('CoordinateUpdate', (data: any) => {
      console.log('📍 Boss coordinates update:', data);
      toast.success(`📡 Boss location updated: ${data.description}`, {
        position: "top-right",
        autoClose: 3000,
      });
      notifyEventHandlers('CoordinateUpdate', data);
    });




    // 🧩 Lifecycle events
    connection.onreconnecting(() => {
      console.log('🟠 SignalR reconnecting...');
      notifyEventHandlers('disconnected', null);
    });

    connection.onreconnected(() => {
      console.log('🟢 SignalR reconnected');
      notifyEventHandlers('connected', null);
    });

    connection.onclose((error) => {
      console.log('🔴 SignalR disconnected:', error);
      notifyEventHandlers('disconnected', null);
    });
  }

  // 🟢 Start connection only if Disconnected
  if (connection.state === signalR.HubConnectionState.Disconnected) {
    try {
      await connection.start();
      console.log('✅ SignalR connected successfully');
      notifyEventHandlers('connected', null);
    } catch (err) {
      console.error('❌ SignalR connection failed:', err);
      notifyEventHandlers('error', err);
    }
  }
};


// Notify all subscribers for a given event
const notifyEventHandlers = <T>(event: string, data: T): void => {
  if (eventHandlers[event]) {
    eventHandlers[event].forEach(callback => callback(data));
  }
};

// Subscribe to an event
export const subscribe = <T>(event: string, callback: EventCallback<T>): void => {
  if (!eventHandlers[event]) {
    eventHandlers[event] = [];
  }
  eventHandlers[event].push(callback as EventCallback<any>);

  // If already connected, attach live listener immediately
  if (connection && connection.state === signalR.HubConnectionState.Connected) {
    connection.on(event, callback as any);
  }
};

// Unsubscribe from an event
export const unsubscribe = <T>(event: string, callback: EventCallback<T>): void => {
  if (!eventHandlers[event]) return;
  const index = eventHandlers[event].indexOf(callback as EventCallback<any>);
  if (index !== -1) {
    eventHandlers[event].splice(index, 1);
  } 

  if (connection) {
    connection.off(event, callback as any);
  }
};

// Stop the connection manually (optional)
export const stopConnection = async (): Promise<void> => {
  if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
    await connection.stop();
    console.log('🛑 SignalR connection stopped');
  }
};

// Check if connected
export const isConnected = (): boolean => {
  return connection?.state === signalR.HubConnectionState.Connected;
};

// Get connection state (helper)
export const getConnectionState = (): string => {
  return connection?.state ?? signalR.HubConnectionState.Disconnected;
};


// Type of socket events
export type SocketEvent =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'fieldEngineerUpdate'
  | 'newFieldEngineer'
  | 'newRoute'
  | 'routeUpdate'
  | 'CoordinateUpdate'
  | 'routeCompleted';

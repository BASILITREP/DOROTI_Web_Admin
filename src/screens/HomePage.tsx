import { useEffect, useRef, useState, } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Header from "../header/Header";
import Sidebar from "../screens/HomePage/Sidebar";
import LocationHistoryPanel from "../screens/HomePage/LocationHistoryPanel";

import type {

  FieldEngineer,

  OngoingRoute,
} from "../types";

import {

  fetchFieldEngineers,



} from "../services/api";
import {
  subscribe,
  unsubscribe,
  getConnectionState,
} from "../services/socketService";

// SET THE ACCESS TOKEN HERE, AT THE TOP LEVEL
mapboxgl.accessToken = "pk.eyJ1IjoiYmFzaWwxLTIzIiwiYSI6ImNtZWFvNW43ZTA0ejQycHBtd3dkMHJ1bnkifQ.Y-IlM-vQAlaGr7pVQnug3Q";


function HomePage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string | number]: mapboxgl.Marker }>({});

  const [fieldEngineers, setFieldEngineers] = useState<FieldEngineer[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showFieldEngineers] = useState<boolean>(true);

  const [statusFilter] = useState<string | null>(null);
  const [ongoingRoutes] = useState<OngoingRoute[]>([]);


  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false); // Add sidebar state

  const [selectedFEForHistory, setSelectedFEForHistory] = useState<FieldEngineer | null>(null);

  const routeLayerId = "active-route-layer";



  //remove route layers and sources
  const clearMapRoute = () => {
    if (!map.current) return;

    // Remove route layers and sources
    const layersAndSources = ["activity-route", "activity-start", "activity-end", "activity-stop"];
    for (const id of layersAndSources) {
      if (map.current.getLayer(id)) map.current.removeLayer(id);
      if (map.current.getSource(id)) map.current.removeSource(id);
    }

    console.log("🧹 Cleared map route and markers");
  };



  // Handle field engineer selection from sidebar
  const handleFieldEngineerSelect = (fe: FieldEngineer | null) => {
    if (fe && map.current) {
      // Fly to the selected field engineer's location
      map.current.flyTo({
        center: [fe.lng, fe.lat],
        zoom: 16,
        duration: 2000,
      });

      // Open the marker's popup if it exists
      if (markers.current[fe.id]) {
        markers.current[fe.id].togglePopup();
      }
    }

    // Set the selected FE for history panel
    setSelectedFEForHistory(fe);

  };

  // Fetch field engineers from API
  const fetchFieldEngineersData = async () => {
    try {
      const data = await fetchFieldEngineers();
      setFieldEngineers(data);
      // setLoading(false); // REMOVED: This is the cause of the race condition.
    } catch (err) {
      console.error("Error fetching field engineers:", err);
      setError("Failed to fetch field engineers data.");
      // setLoading(false); // REMOVED
    }
  };


  useEffect(() => {
    if (map.current) {
      // Small delay to allow CSS transition to complete
      setTimeout(() => {
        map.current?.resize();
      }, 300);
    }
  }, [sidebarCollapsed]);

  // Replace the existing handleBossCoordinates useEffect with this:

  useEffect(() => {
    const handleBossCoordinates = (data: any) => {
      console.log("Boss coordinates received:", data);

      if (!map.current || !data.latitude || !data.longitude) return;

      const bossMarkerId = "boss-marker";
      const color = "#ff4444"; // Red color for boss

      if (markers.current[bossMarkerId]) {
        // Update existing marker position and make visible
        markers.current[bossMarkerId].setLngLat([
          data.longitude,
          data.latitude,
        ]);
        markers.current[bossMarkerId].getElement().style.display = "block";

        // Update marker color (in case it changes)
        const markerElement = markers.current[bossMarkerId].getElement();
        markerElement.style.backgroundColor = color;

        // Update popup content
        const timeString = new Date(data.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 10px; text-align: center;">
            <strong style="color: #ff4444;">👑 Boss Location</strong><br/>
            <span style="color: #666; font-size: 12px;">${data.description || "Boss is here"
          }</span><br/>
            <span style="color: #888; font-size: 11px;">
              Updated: ${timeString}
            </span><br/>
            <span style="color: #999; font-size: 10px;">
              ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}
            </span>
          </div>
        `);

        markers.current[bossMarkerId].setPopup(popup);
      } else {
        // Create a new boss marker
        const el = document.createElement("div");
        el.className = "boss-marker";
        el.style.width = "25px";
        el.style.height = "25px";
        el.style.backgroundColor = color;
        el.style.border = "3px solid white";
        el.style.borderRadius = "50%";
        el.style.boxShadow = "0 0 15px rgba(255, 68, 68, 0.8)";
        el.style.cursor = "pointer";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.fontSize = "12px";
        el.innerHTML = "👑"; // Crown for boss

        // Add animation ping effect (same as field engineers)
        const ping = document.createElement("div");
        ping.style.width = "100%";
        ping.style.height = "100%";
        ping.style.borderRadius = "50%";
        ping.style.backgroundColor = `${color}80`; // Add transparency
        ping.style.animation = "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite";
        ping.style.position = "absolute";
        ping.style.top = "0";
        ping.style.left = "0";
        ping.style.zIndex = "-1";
        el.style.position = "relative";
        el.appendChild(ping);

        // Format the timestamp
        const timeString = new Date(data.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Add a popup
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 10px; text-align: center;">
            <strong style="color: #ff4444;">👑 Boss Location</strong><br/>
            <span style="color: #666; font-size: 12px;">${data.description || "Boss is here"
          }</span><br/>
            <span style="color: #888; font-size: 11px;">
              Updated: ${timeString}
            </span><br/>
            <span style="color: #999; font-size: 10px;">
              ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}
            </span>
          </div>
        `);

        // Create and store the marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([data.longitude, data.latitude])
          .setPopup(popup)
          .addTo(map.current);

        markers.current[bossMarkerId] = marker;
      }

      // Fly to boss location with animation (keep this part)
      map.current.flyTo({
        center: [data.longitude, data.latitude],
        zoom: 15,
        duration: 2000,
      });
    };

    // Subscribe to boss coordinate updates
    subscribe("CoordinateUpdate", handleBossCoordinates);

    return () => {
      unsubscribe("CoordinateUpdate", handleBossCoordinates);
    };
  }, []);

  useEffect(() => {
    const handleNewFieldEngineer = (fe: any) => {
      console.log("New field engineer received:", fe);
      const transformedFE: FieldEngineer = {
        id: fe.id,
        name: fe.name,
        lng: fe.currentLongitude || 0,
        lat: fe.currentLatitude || 0,
        status: fe.status || "Active",
        updatedAt: fe.updatedAt || new Date().toISOString(),
        fcmToken: fe.fcmToken || "",
      };
      console.log("Adding new field engineer to state:", transformedFE);

      // Update existing FE if it exists, otherwise add new one
      setFieldEngineers((prev) => {
        const existingIndex = prev.findIndex(
          (engineer) => engineer.id === transformedFE.id
        );
        if (existingIndex >= 0) {
          // Update existing field engineer
          const updated = [...prev];
          updated[existingIndex] = transformedFE;
          return updated;
        } else {
          // Add new field engineer
          return [...prev, transformedFE];
        }
      });
    };

    subscribe("ReceiveNewFieldEngineer", handleNewFieldEngineer); // Changed from 'newFieldEngineer'
    return () => {
      unsubscribe("ReceiveNewFieldEngineer", handleNewFieldEngineer);
    };
  }, []);




  useEffect(() => {
    // REMOVE THE TOKEN ASSIGNMENT FROM HERE
    // mapboxgl.accessToken =
    //   "pk.eyJ1IjoiYmFzaWwxLTIzIiwiYSI6ImNtZWFvNW43ZTA0ejQycHBtd3dkMHJ1bnkifQ.Y-IlM-vQAlaGr7pVQnug3Q";

    if (mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [121.774017, 12.879721],
        zoom: 5.5,
      });

      // Add navigation controls (optional)
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Wait for map to load
      map.current.on("load", () => {
        // Add keyframes for ping animation to document head
        if (!document.getElementById("ping-animation")) {
          const style = document.createElement("style");
          style.id = "ping-animation";
          style.innerHTML = `
          @keyframes ping {
            75%, 100% {
              transform: scale(2);
              opacity: 0;
            }
          }
        `;
          document.head.appendChild(style);
        }

        // DO NOT FETCH DATA HERE. This is causing a race condition.
        // The main useEffect at the bottom of the file handles all initial fetching.



      });
    }

    return () => {
      if (map.current) {
        if (map.current.getLayer(routeLayerId)) {
          map.current.removeLayer(routeLayerId);
          map.current.removeSource(routeLayerId);
        }
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const statusStyles: Record<string, { color: string; pulse: string }> = {
    Active: {
      color: "#4CAF50",
      pulse: "ping 1.2s ease-out infinite", // faster pulse
    },
    "Location Off": {
      color: "#FFA500",
      pulse: "ping 2s ease-out infinite", // slower
    },
    "Logged In": {
      color: "#1E90FF",
      pulse: "ping 1.5s ease-in-out infinite",
    },
    "Off-work": {
      color: "#9E9E9E",
      pulse: "none", // no pulse
    },
    Inactive: {
      color: "#FF0000",
      pulse: "ping 2.5s linear infinite", // very slow
    },
  };





  // Update markers when field engineers data changes or filters change
  useEffect(() => {
    if (!map.current || loading || fieldEngineers.length === 0) return;

    // First, hide all existing markers
    Object.values(markers.current).forEach((marker) => {
      marker.getElement().style.display = "none";
    });

    // Skip processing if field engineers are hidden
    if (!showFieldEngineers) return;

    // Filter engineers based on status if filter is set
    const filteredEngineers = statusFilter
      ? fieldEngineers.filter((eng) => eng.status === statusFilter)
      : fieldEngineers;

    // Update existing markers and add new ones
    filteredEngineers.forEach((engineer) => {
      // Status color mapping
      // Status color mapping (update this block)
      const statusColors: Record<string, string> = {
        Active: "#4CAF50",          // 🟢 Green
        "Location Off": "#FFA500",  // 🟠 Orange
        "Logged In": "#1E90FF",     // 🔵 Blue
        "Off-work": "#9E9E9E",      // ⚪ Gray
        Inactive: "#FF0000",        // 🔴 Red
      };


      const color =
        statusColors[engineer.status as keyof typeof statusColors] || "#ff4d4f";

      if (markers.current[engineer.id]) {
        // Update existing marker position and make visible
        markers.current[engineer.id].setLngLat([engineer.lng, engineer.lat]);
        markers.current[engineer.id].getElement().style.display = "block";

        // Update marker color
        const markerElement = markers.current[engineer.id].getElement();
        markerElement.style.backgroundColor = color;

        // Update ping color
        const pingElement = markerElement.querySelector('div') as HTMLDivElement;
        if (pingElement) {
          pingElement.style.backgroundColor = `${color}80`;
          pingElement.style.animation =
            statusStyles[engineer.status]?.pulse || "ping 1.5s infinite";
        }


        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px;">
          <strong>${engineer.name}</strong><br/>
          <span style="font-size: 12px;">Status: <b>${engineer.status}</b></span><br/>
          <span style="font-size: 12px;">📍 ${engineer.currentAddress || "Unknown"}</span><br/>
          <span style="font-size: 10px; color: #888;">Last updated: ${engineer.timeIn
            ? new Date(engineer.timeIn).toLocaleString()
            : "N/A"}
</span>
        </div>
      `);


        markers.current[engineer.id].setPopup(popup);
      } else {
        // Create a new marker
        const el = document.createElement("div");
        el.className = "field-engineer-marker";
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.backgroundColor = color;
        el.style.border = "2px solid white";
        el.style.borderRadius = "50%";
        el.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
        el.style.cursor = "pointer";

        // Add animation ping effect
        const ping = document.createElement("div");
        ping.style.width = "100%";
        ping.style.height = "100%";
        ping.style.borderRadius = "50%";
        ping.style.backgroundColor = `${color}80`; // Add transparency
        ping.style.animation = statusStyles[engineer.status]?.pulse || "ping 1.5s infinite";

        el.appendChild(ping);

        // Format the last updated time
        const lastUpdated = new Date(engineer.updatedAt);
        const timeString = lastUpdated.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Add a popup
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px;">
          <strong>${engineer.name}</strong><br/>
          <span class="text-xs">Status: ${engineer.status}</span><br/>
          <span class="text-xs">Last Updated: ${timeString}</span>
        </div>
      `);

        // Create and store the marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([engineer.lng, engineer.lat])
          .setPopup(popup)
          .addTo(map.current!);

        markers.current[engineer.id] = marker;
      }
    });
  }, [fieldEngineers, loading, showFieldEngineers, statusFilter]);

  // Initialize socket connection
  // Track real-time socket status only (no re-initialization)
  useEffect(() => {

    // Immediately reflect current connection status on mount
    const currentState = getConnectionState();
    if (currentState === "Connected") {
      setSocketConnected(true);
    } else {
      setSocketConnected(false);
    }
    const handleConnected = () => {
      setSocketConnected(true);
      console.log("🟢 SignalR connected");
    };

    const handleDisconnected = () => {
      setSocketConnected(false);
      console.log("🔴 SignalR disconnected");
    };

    const handleError = (err: any) => {
      console.error("⚠️ SignalR error:", err);
      setSocketConnected(false);
    };

    subscribe("connected", handleConnected);
    subscribe("disconnected", handleDisconnected);
    subscribe("error", handleError);

    return () => {
      unsubscribe("connected", handleConnected);
      unsubscribe("disconnected", handleDisconnected);
      unsubscribe("error", handleError);
    };
  }, []);


  // Subscribe to field engineer updates
  useEffect(() => {
    let lastUpdateTime: { [id: number]: number } = {};

    const handleFieldEngineerUpdate = (fe: any) => {
      console.log("⚡ Real-time FE update received:", fe);

      const transformedFE = {
        id: fe.id,
        name: fe.name,
        lat: fe.currentLatitude,
        lng: fe.currentLongitude,
        status: fe.status,
        fcmToken: fe.fcmToken || "",
        currentAddress: fe.currentAddress || "Awaiting GPS signal...",
        timeIn: fe.timeIn || fe.updatedAt || new Date().toISOString(),
        updatedAt: fe.updatedAt || new Date().toISOString(),
      };

      // ✅ Move the marker instantly
      if (markers.current[transformedFE.id]) {
        markers.current[transformedFE.id].setLngLat([transformedFE.lng, transformedFE.lat]);
      }

      // 🕐 Update state only every 5 seconds to reduce lag
      const now = Date.now();
      if (!lastUpdateTime[transformedFE.id] || now - lastUpdateTime[transformedFE.id] > 5000) {
        lastUpdateTime[transformedFE.id] = now;

        setFieldEngineers((prev) =>
          prev.map((engineer) =>
            engineer.id === transformedFE.id ? transformedFE : engineer
          )
        );
      }
    };

    subscribe("fieldEngineerUpdate", handleFieldEngineerUpdate);

    return () => {
      unsubscribe("fieldEngineerUpdate", handleFieldEngineerUpdate);
    };
  }, []);


  // Initial data fetch on component mount
  useEffect(() => {
    const fetchAllInitialData = async () => {
      setLoading(true);
      try {
        await fetchFieldEngineersData();
      } catch (error) {
        console.error("Error during initial data fetch:", error);
        setError("Failed to load initial application data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllInitialData();
  }, []);

  const ActivityMapCard = ({ lat, lng }: { lat: number; lng: number }) => {
    // Use Mapbox Static Image API instead of creating a full map
    // FIX: Correctly format the URL to use 'auto' for the viewport.
    const staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ff4136(${lng},${lat})/auto/300x150@2x?padding=50&access_token=${mapboxgl.accessToken}`;

    return (
      <img
        src={staticMapUrl}
        alt="Location"
        className="mt-3 rounded-lg w-full h-24 object-cover"
        loading="lazy"
      />
    );
  };

  const ActivityDriveMapCard = ({
    startLat,
    startLng,
    endLat,
    endLng,
  }: {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
  }) => {
    // Check if the drive is essentially zero distance
    if (startLat === endLat && startLng === endLng) {
      // If start and end are the same, just show a single marker like in ActivityMapCard
      return <ActivityMapCard lat={startLat} lng={startLng} />;
    }

    // Define markers for start (green 'A') and end (red 'B')
    const startMarker = `pin-s-a+4CAF50(${startLng},${startLat})`;
    const endMarker = `pin-s-b+F44336(${endLng},${endLat})`;

    // CORRECTLY format the coordinates as a GeoJSON LineString
    const geojson = {
      type: "LineString",
      coordinates: [
        [startLng, startLat],
        [endLng, endLat],
      ],
    };

    // URL-encode the GeoJSON object to be used in the path parameter
    const encodedPath = encodeURIComponent(JSON.stringify(geojson));

    // Define the path overlay with the correctly encoded GeoJSON
    // FIX: The parentheses around the encoded path are required by the API.
    const path = `path-5+3887BE-0.8(${encodedPath})`;

    // Construct the final URL. 'auto' will now correctly fit the bounds of the path and markers.
    const staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${startMarker},${endMarker},${path}/auto/300x150@2x?padding=50&access_token=${mapboxgl.accessToken}`;

    return (
      <img
        src={staticMapUrl}
        alt="Route map"
        className="mt-2 rounded-lg w-full h-20 object-cover"
        loading="lazy"
      />
    );
  };



  //Main return
  return (
    <div className="h-screen flex overflow-hidden relative">
      {/* Full-screen Map Background */}
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full bg-base-200 z-0"
      />

      {/* Overlay for loading/error states */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-50">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}
      {error && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Floating Header - Adjusts based on sidebar */}
      <div className={`absolute top-0 left-0 transition-all duration-300 z-40 ${sidebarCollapsed ? 'right-10' : 'right-[320px]'
        }`}>
        <Header activePage="dashboard" />
      </div>

      {/* Connection status indicator */}
      <div
        className={`fixed bottom-1 right-1 z-50 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${socketConnected ? "bg-green-500/80" : "bg-red-500/80"
          } backdrop-blur-sm shadow-lg`}
      >
        <div
          className={`w-2 h-2 rounded-full ${socketConnected ? "bg-green-200 animate-pulse" : "bg-red-200"
            }`}
        ></div>
        <span className="text-white">
          {socketConnected ? "Live" : "Offline"}
        </span>
      </div>
      {/* Global Floating Tooltip */}
      <div
        id="floating-tooltip"
        className="fixed z-[9999] hidden bg-black/90 text-white text-xs px-3 py-2 rounded-md whitespace-pre-line shadow-lg pointer-events-none transition-opacity duration-200"
        style={{
          transform: "translate(-40%, -120%)",
        }}
      ></div>


      {/* Floating Activity Log Panel - Bottom (only when FE is selected) */}
      {selectedFEForHistory && (
        <div
          className="fixed bottom-0 transition-all duration-300 z-30"
          style={{
            width: "810px", // ✅ solid width, never changes
            left: sidebarCollapsed ? "50%" : "calc(50% - 7rem)", // ✅ slide slightly left when sidebar expands
            transform: "translateX(-50%)", // ✅ keep horizontally centered
          }}
        >

          <LocationHistoryPanel
            selectedEngineer={selectedFEForHistory}
            onClose={() => {
              clearMapRoute(); // ✅ clear map when closing the panel
              setSelectedFEForHistory(null);
            }}

            mapRef={map}
          />
        </div>
      )}

      {/* Floating Sidebar - Right side */}
      <div className="absolute top-0 right-0 bottom-0 z-40 h-full">
        <Sidebar

          ongoingRoutes={ongoingRoutes}
          fieldEngineers={fieldEngineers}
          loading={loading}
          error={error}


          onCollapseChange={setSidebarCollapsed}
          onFieldEngineerSelect={(fe) => {
            if (!fe) clearMapRoute(); // ✅ clear map when going back to list
            handleFieldEngineerSelect(fe);
          }}
          ActivityMapCard={ActivityMapCard}
          ActivityDriveMapCard={ActivityDriveMapCard}
        />
      </div>
    </div>
  );
}

export default HomePage;

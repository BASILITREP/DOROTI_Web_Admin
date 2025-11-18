import React, { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import { fetchRawPoints } from "../../services/api";
import type { RawLocationPoint } from "../../services/api";
import type { FieldEngineer, ActivityHistory } from "../../types";
import { reverseGeocode } from "../../utils/reverseGeocoding";
import { useAppContext } from "../../context/StateContext";


interface LocationHistoryPanelProps {
  selectedEngineer: FieldEngineer;
  onClose: () => void;
  mapRef: React.MutableRefObject<mapboxgl.Map | null>; // 👈 receive from parent

}

const LocationHistoryPanel: React.FC<LocationHistoryPanelProps> = ({
  selectedEngineer,
  onClose,
  mapRef: map,

}) => {
  //const [historyData, setHistoryData] = useState<ActivityHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localCollapsed, setLocalCollapsed] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  //const [selectedActivityId, setSelectedActivityId] = useState<string | number | null>(null);

  const [filter] = useState<"all" | "drive" | "stop">("all");

  const [sidebarCollapsed] = useState<boolean>(false); // Add sidebar state
  //const [stayDurationFilter, setStayDurationFilter] = useState<number | null>(null); // in minutes, null = no filter
  const [rawPoints, setRawPoints] = useState<RawLocationPoint[]>([]);

  const [shortStays, setShortStays] = useState<{ lat: number; lng: number; duration: number }[]>([]);
  let activeFetchToken = useRef<symbol | null>(null);

  const {
  historyData, setHistoryData,
  selectedActivityId, setSelectedActivityId,
  stayDurationFilter, setStayDurationFilter,
  dateRange, setDateRange
} = useAppContext();







  // --- Helpers ---
  function toDate(s: string) { return new Date(s); }

  async function loadDriveAddresses(latA: number, lonA: number, latB: number, lonB: number) {
    const start = await reverseGeocode(latA, lonA);
    const end = await reverseGeocode(latB, lonB);

    console.log("Drive start:", start.locationName, "-", start.address);
    console.log("Drive end:", end.locationName, "-", end.address);

    return { start, end };
  }

  function formatTime12(d: Date) {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  // Haversine distance in KM
  function haversineKm(a: RawLocationPoint, b: RawLocationPoint) {
    const R = 6371;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLon = (b.longitude - a.longitude) * Math.PI / 180;
    const lat1 = a.latitude * Math.PI / 180;
    const lat2 = b.latitude * Math.PI / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const x = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  }

  // Compute segment metrics
  function computeSegmentMetrics(points: RawLocationPoint[]) {
    if (points.length < 2) {
      return {
        distanceKm: 0,
        durationMinutes: 0,
        topSpeedKmh: 0,
      };
    }

    let distanceKm = 0;
    let topSpeedKmh = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      distanceKm += haversineKm(prev, curr);

      // prefer provided speed if present; else estimate
      const ms = (curr.speed ?? 0);
      const kmhFromSensor = ms * 3.6;
      const dtHr = (toDate(curr.timestamp).getTime() - toDate(prev.timestamp).getTime()) / 3600000;
      const estKmh = dtHr > 0 ? (haversineKm(prev, curr) / dtHr) : 0;
      const segSpeed = Math.max(kmhFromSensor, estKmh);
      if (segSpeed > topSpeedKmh) topSpeedKmh = segSpeed;
    }

    const durationMinutes = Math.max(
      0,
      Math.round((toDate(points[points.length - 1].timestamp).getTime() - toDate(points[0].timestamp).getTime()) / 60000)
    );

    return { distanceKm, durationMinutes, topSpeedKmh: Math.round(topSpeedKmh) };
  }

  // Fare computation (same as backend)
  function computeFare(distanceKm: number) {
    const BASE_FARE = 25.0;
    const BASE_DISTANCE_KM = 2.5;
    const EXTRA_DISTANCE_STEP_KM = 1.5;
    const EXTRA_FARE_AMOUNT = 5.0;

    let fare = BASE_FARE;
    if (distanceKm > BASE_DISTANCE_KM) {
      const extra = distanceKm - BASE_DISTANCE_KM;
      const steps = Math.ceil(extra / EXTRA_DISTANCE_STEP_KM);
      fare += steps * EXTRA_FARE_AMOUNT;
    }
    return fare;
  }

  function groupIntoDriveSegments(points: RawLocationPoint[], stayThresholdMin: number) {
    const mergeStops: RawLocationPoint[] = [];

    if (!points || points.length < 2) return [];

    const sorted = [...points].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const segments: { points: RawLocationPoint[]; stayBeforeMinutes: number }[] = [];

    let current: RawLocationPoint[] = [sorted[0]];
    let stopStart: number | null = null;
    let accumulatedStay = 0;

    for (let i = 1; i < sorted.length; i++) {
   
      const curr = sorted[i];

      const currTime = new Date(curr.timestamp).getTime();
      const isStopped = (curr.speed ?? 0) === 0;

      if (isStopped) {
        // Start timing stop
        if (stopStart === null) stopStart = currTime;
      } else {
        // End of stop → compute duration
        if (stopStart !== null) {
          const stopDuration = (currTime - stopStart) / 60000;
          accumulatedStay += stopDuration;
          stopStart = null;
        }
      }

      // 🔥 TRIGGER SPLIT ONLY WHEN STOP DURATION EXCEEDS THRESHOLD
      if (accumulatedStay >= stayThresholdMin) {
        const lastStopPoint = sorted[i - 1];
        mergeStops.push(lastStopPoint); // record where the merge happened
        segments.push({
          points: [...current],
          stayBeforeMinutes: Math.floor(accumulatedStay),
        });
        current = [current[current.length - 1], curr];
        accumulatedStay = 0;
      } else {
        current.push(curr);
      }
    }

    // ✅ handle unfinished stop at end (still within last segment)
    if (stopStart !== null) {
      const lastTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
      const finalStopDuration = (lastTime - stopStart) / 60000;

      if (finalStopDuration >= stayThresholdMin && current.length > 1) {
        segments.push({
          points: [...current],
          stayBeforeMinutes: Math.floor(finalStopDuration),
        });
        current = [current[current.length - 1]]; // reset anchor
      } else {
        accumulatedStay += finalStopDuration;
      }
    }


    // ✅ Always push the last segment if it has movement
    // ✅ Push last segment only if it did NOT already end with a qualified stay
    if (current.length > 1 && accumulatedStay < stayThresholdMin) {
      segments.push({
        points: [...current],
        stayBeforeMinutes: Math.floor(accumulatedStay),
      });
    }


    // ✅ 🟢 ALWAYS INCLUDE CLOCK-IN DRIVE (ANCHOR)
    // ✅ Include initial drive only if no segment starts at first timestamp
    if (
      segments.length === 0 ||
      (segments[0].points.length > 0 &&
        segments[0].points[0].timestamp !== sorted[0].timestamp)
    ) {
      segments.unshift({
        points: sorted.slice(0, 2),
        stayBeforeMinutes: 0,
      });
    }


    console.log("✅ FINAL SEGMENTS (clean):");
    console.table(
      segments.map((s, i) => ({
        seg: i + 1,
        start: s.points[0].timestamp,
        end: s.points[s.points.length - 1].timestamp,
        stayBefore: s.stayBeforeMinutes,
        pts: s.points.length,
      }))
    );

    return segments;
  }






  // Convert a segment → ActivityHistory (progressive rendering enabled)
  async function segmentToActivity(
    seg: { points: RawLocationPoint[]; stayBeforeMinutes: number },
    idx: number,
    onUpdate: (updated: ActivityHistory) => void
  ): Promise<ActivityHistory> {

    const pts = seg.points;
    const start = pts[0];
    const end = pts[pts.length - 1];

    const { distanceKm, durationMinutes, topSpeedKmh } = computeSegmentMetrics(pts);

    const routePairs = pts.map(p => [p.longitude, p.latitude]);
    const routePathJson = JSON.stringify(routePairs);

    let startTime = toDate(start.timestamp);
    const endTime = toDate(end.timestamp);

    // 1️⃣ INITIAL CARD (INSTANT RENDER)
    const partial: ActivityHistory = {
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      feId: start.fieldEngineerId,
      type: "drive",
      startAddress: "Loading address…",
      endAddress: "Loading address…",
      distance: `${distanceKm.toFixed(2)} km`,
      timeRange: `${formatTime12(startTime)} - ${formatTime12(endTime)}`,
      duration: `${durationMinutes} min`,
      topSpeed: `${topSpeedKmh} km/h`,
      calculatedFare: computeFare(distanceKm),
      startLat: start.latitude,
      startLng: start.longitude,
      endLat: end.latitude,
      endLng: end.longitude,
      routePathJson,
      startTime: start.timestamp,
      endTime: end.timestamp,
      stayBeforeMinutes: seg.stayBeforeMinutes,
    };

    // Return immediately → UI renders this instantly
    setTimeout(() => onUpdate(partial), 0);

    // 2️⃣ BACKGROUND ADDRESS FETCH (non-blocking)
    try {
      const { start: startGeo, end: endGeo } = await loadDriveAddresses(
        start.latitude,
        start.longitude,
        end.latitude,
        end.longitude
      );

      // 3️⃣ UPDATE CARD AFTER GEOCODE FINISHES
      const updated = {
        ...partial,
        startAddress: startGeo.address,
        endAddress: endGeo.address,
      };

      onUpdate(updated);
    } catch (e) {
      console.error("Reverse geocoding failed:", e);
    }
    return partial;
  }


  const mToDeg = (m: number) => m / 111_320;

  // const [dateRange, setDateRange] = useState<{
  //   startDate: string;
  //   endDate: string;
  // }>({
  //   startDate: new Date().toISOString().split('T')[0], // Today
  //   endDate: new Date().toISOString().split('T')[0],   // Today
  // });




  useEffect(() => {
    if (!selectedEngineer) return;
    (async () => {
      setIsLoading(true);
      setHistoryData([]);
      try {

        // ✅ Pass date range to initial fetch
        const raw = await fetchRawPoints(
          selectedEngineer.id,
          dateRange.startDate,
          dateRange.endDate
        );
        setRawPoints(raw);


      } catch (err) {
        console.error("Failed to load raw points:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedEngineer, dateRange]);

  useEffect(() => {
    if (!rawPoints.length) return;
    if (isLoading) return;
    if (stayDurationFilter === null) {
      console.log("🧩 Filter cleared, skipping stale recompute.");
      return;
    }

    const renderToken = Symbol("render");
    activeFetchToken.current = renderToken;
    let isCancelled = false;

    setIsLoading(true);

    (async () => {
      try {
        const threshold = stayDurationFilter ?? 0;
        const segments = groupIntoDriveSegments(rawPoints, threshold);

        // --- Short stay detection ---
        const detectedShortStays: { lat: number; lng: number; duration: number }[] = [];
        let stopStart: RawLocationPoint | null = null;
        let stopStartTime: number | null = null;

        for (let i = 1; i < rawPoints.length; i++) {

          const curr = rawPoints[i];
          const currTime = new Date(curr.timestamp).getTime();
 

          if ((curr.speed ?? 0) === 0) {
            if (!stopStart) {
              stopStart = curr;
              stopStartTime = currTime;
            }
          } else if (stopStart && stopStartTime) {
            const duration = (currTime - stopStartTime) / 60000;
            if (duration > 0 && duration < threshold) {
              detectedShortStays.push({
                lat: stopStart.latitude,
                lng: stopStart.longitude,
                duration: Math.round(duration),
              });
            }
            stopStart = null;
            stopStartTime = null;
          }
        }

        if (isCancelled || activeFetchToken.current !== renderToken) return;
        setShortStays(detectedShortStays);

        // --- Drive computation ---
        const hasQualifiedStay = segments.some(seg => seg.stayBeforeMinutes >= threshold);
        if (!hasQualifiedStay && threshold > 0) {
          console.warn(`ℹ️ No stay duration lasted for ${threshold} minutes.`);
          setHistoryData([]);
          setIsLoading(false);
          return;
        }

        console.log(`🚀 Processing ${segments.length} segments...`);


        // ⚡ Build all cards with unique IDs
        const allCards: ActivityHistory[] = [];

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const pts = seg.points;
          const start = pts[0];
          const end = pts[pts.length - 1];
          const { distanceKm, durationMinutes, topSpeedKmh } = computeSegmentMetrics(pts);
          const routePairs = pts.map(p => [p.longitude, p.latitude]);
          const routePathJson = JSON.stringify(routePairs);
          const startTime = toDate(start.timestamp);
          const endTime = toDate(end.timestamp);

          // ✅ Generate unique ID using timestamp + index + random
          const uniqueId = `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;

          const card: ActivityHistory = {
            id: uniqueId,
            feId: start.fieldEngineerId,
            type: "drive",
            startAddress: "Loading address…",
            endAddress: "Loading address…",
            distance: `${distanceKm.toFixed(2)} km`,
            timeRange: `${formatTime12(startTime)} - ${formatTime12(endTime)}`,
            duration: `${durationMinutes} min`,
            topSpeed: `${topSpeedKmh} km/h`,
            calculatedFare: computeFare(distanceKm),
            startLat: start.latitude,
            startLng: start.longitude,
            endLat: end.latitude,
            endLng: end.longitude,
            routePathJson,
            startTime: start.timestamp,
            endTime: end.timestamp,
            stayBeforeMinutes: seg.stayBeforeMinutes,
          };

          allCards.push(card);
        }

        console.log(`✅ Created ${allCards.length} cards, setting state...`);
        console.log('allCards', allCards);

        // ✅ Set all cards at once
        if (!isCancelled && activeFetchToken.current === renderToken) {
          setHistoryData(allCards);

          setIsLoading(false);
          console.log(`✅ Cards set in state, total: ${allCards.length}`);
        }

        // 🔄 Fetch addresses in background
        for (let i = 0; i < segments.length; i++) {
          if (isCancelled || activeFetchToken.current !== renderToken) {
            console.log("🛑 Address fetching cancelled");
            break;
          }

          const seg = segments[i];
          const pts = seg.points;
          const start = pts[0];
          const end = pts[pts.length - 1];
          const cardId = allCards[i].id;

          try {
            const { start: startGeo, end: endGeo } = await loadDriveAddresses(
              start.latitude,
              start.longitude,
              end.latitude,
              end.longitude
            );

            if (isCancelled || activeFetchToken.current !== renderToken) {
              console.log("🛑 Skipping address update - cancelled");
              return;
            }

            console.log(`📍 Updating card ${i + 1}/${segments.length} with addresses`);

            setHistoryData((prev) => {
              const updated = prev.map((card) =>
                card.id === cardId
                  ? {
                    ...card,
                    startAddress: startGeo.address,
                    endAddress: endGeo.address,
                  }
                  : card
              );
              return updated;
            });
          } catch (e) {
            console.error(`❌ Geocoding failed for card ${i + 1}:`, e);
          }
        }

        console.log("✅ All addresses fetched");

      } catch (err) {
        console.error("⚠️ Failed to process filtered drives:", err);
        if (!isCancelled && activeFetchToken.current === renderToken) {
          setHistoryData([]);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      console.log("🧹 Cleanup: cancelling current operation");
      isCancelled = true;
    };
  }, [stayDurationFilter, rawPoints]);


  function convertTo24Hour(timeStr: string): string {
    const [time, modifier] = timeStr.trim().split(/\s+/);
    let [hours, minutes] = time.split(':').map(Number);
    const mod = modifier?.toUpperCase() ?? "";

    if (mod === "PM" && hours < 12) hours += 12;
    if (mod === "AM" && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  }

  // 📤 Export to Excel Function
  const handleExportToExcel = () => {
    if (historyData.length === 0) {
      alert("No activity data available to export.");
      return;
    }

    const worksheetData = historyData.map((item) => ({
      ID: item.id,
      Type: item.type,
      "Start Address": item.startAddress || "",
      "End Address": item.endAddress || "",
      "Distance (km)": item.distance || "",
      "Time Range": item.timeRange || "",
      "Top Speed": item.topSpeed || "",
      "Stay Before (min)": (item as any).stayBeforeMinutes ?? "",
    }));


    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activity History");

    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });

    const filename = `${selectedEngineer.name}_ActivityHistory.xlsx`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };



  // ✨ Manual refresh button (optional, for user control)
  const handleRefreshHistory = async () => {
    if (!selectedEngineer) return;

    const token = Symbol("render");
    activeFetchToken.current = token;

    setIsLoading(true);


    try {
      // ✅ Pass date range to backend
      const raw = await fetchRawPoints(
        selectedEngineer.id,
        dateRange.startDate,
        dateRange.endDate
      );


      if (activeFetchToken.current !== token) {
        console.log("🛑 fetch cancelled, newer request initiated");
        return;
      }

      console.log("🧩 Raw points sample:", raw.slice(0, 5));
      setRawPoints(raw);

      const segments = groupIntoDriveSegments(raw, stayDurationFilter ?? 5);

      if (activeFetchToken.current !== token) return;

      // 🧹 Clear existing cards immediately
      setHistoryData([]);

      // 🔥 Progressive rendering — NO MORE await Promise.all
      segments.forEach((seg, i) => {
        segmentToActivity(seg, i, (card) => {
          if (activeFetchToken.current !== token) return;

          setHistoryData((prev) => {
            const exists = prev.find((x) => x.id === card.id);
            if (exists) {
              return prev.map((x) => (x.id === card.id ? card : x));
            }
            return [...prev, card];
          });
        });
      });


    } catch (err) {
      console.error("Failed to refresh history:", err);
    } finally {
      if (activeFetchToken.current === token) {
        setIsLoading(false);
        activeFetchToken.current = null;
      }
    }
  };

  // Function to handle horizontal scrolling with mouse wheel
  const handleWheelScroll = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      e.preventDefault();
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  }, []);



  useEffect(() => {
    if (!map.current || !rawPoints.length) return;

    // 🧹 Clear old
    const oldMergedMarkers = document.getElementsByClassName("merged-marker");
    Array.from(oldMergedMarkers).forEach(el => el.remove());
    try {
      if (map.current?.getLayer("merged-lines")) map.current.removeLayer("merged-lines");
      if (map.current?.getSource("merged-lines")) map.current.removeSource("merged-lines");
    } catch (err) {
      console.warn("Skipping map cleanup:", err);
    }

    //if no filter or 0, stop here(dont draw anything)
    if (!stayDurationFilter || stayDurationFilter === 0) {
      console.log("🛑 No stay duration filter set, skipping merged stays rendering.")
      return;
    }

    // Recalculate segments with current filter
    const threshold = stayDurationFilter ?? 0;
    const segments = groupIntoDriveSegments(rawPoints, threshold);

    const mergedFeatures: any[] = [];

    segments.forEach((seg, index) => {
      console.log(
        `Segment ${index + 1}: stayBefore=${seg.stayBeforeMinutes}, threshold=${threshold}, points=${seg.points.length}`
      );

      if (!seg.points || seg.points.length < 2) return;

      // Only render stays below the threshold (i.e., merged short stops)
      if (seg.stayBeforeMinutes > 0 && seg.stayBeforeMinutes < threshold) {
        const coords = seg.points.map(p => [p.longitude, p.latitude]);

        // 🔥 Place marker exactly at the LAST STOP location (not midpoint)
        const lastStop: [number, number] = coords[coords.length - 1] as [number, number]; // end of the subsegment

        // Draw dashed gray mini-line (visual hint of merge)
        mergedFeatures.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: { id: index, stay: seg.stayBeforeMinutes },
        });

        // 🔴 Marker for the stay location
        const el = document.createElement("div");
        el.className = "merged-marker";
        el.style.width = "10px";
        el.style.height = "10px";
        el.style.backgroundColor = "#EF4444"; // 🔴 red for short stay
        el.style.border = "2px solid white";
        el.style.borderRadius = "50%";
        el.style.cursor = "pointer";
        el.style.boxShadow = "0 0 6px rgba(0,0,0,0.5)";


        //also display time
        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
          .setHTML(`
        <div style="font-size: 12px; line-height: 1.4;">
          🕒 Stayed <b>${seg.stayBeforeMinutes} min</b>
          
        </div>
      `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat(lastStop)
          .setPopup(popup)
          .addTo(map.current!);

        el.addEventListener("mouseenter", () => marker.togglePopup());
        el.addEventListener("mouseleave", () => marker.togglePopup());
      }
    });

    // ✅ Inject qualified stops (>= threshold) into shortStays so they get drawn as green markers
    let qualifiedStays: { lat: number; lng: number; duration: number }[] = [];

    if (threshold > 0) {
      qualifiedStays = segments
        .filter(seg => seg.stayBeforeMinutes >= threshold)
        .map(seg => {
          const last = seg.points[seg.points.length - 1];
          return {
            lat: last.latitude,
            lng: last.longitude,
            duration: seg.stayBeforeMinutes
          };
        });
    }

    // merge short + qualified stays for rendering
    const allStays =
      threshold > 0 ? [...shortStays, ...qualifiedStays] : shortStays;

    // 🟠 Add gray dots for short stays (< threshold)
    allStays.forEach((stay) => {
      // Find if this stay exactly matches the END of a qualified segment (true Point B)
      const matchedQualifiedSegment = segments.find((seg) => {
        if (seg.stayBeforeMinutes < threshold) return false;
        const lastPoint = seg.points[seg.points.length - 1];
        const R = 6371000; // meters
        const dLat = ((stay.lat - lastPoint.latitude) * Math.PI) / 180;
        const dLng = ((stay.lng - lastPoint.longitude) * Math.PI) / 180;
        const lat1 = (stay.lat * Math.PI) / 180;
        const lat2 = (lastPoint.latitude * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance < 30; // ✅ within 30 m of the qualified segment’s END only
      });

      // Choose tooltip text
      //add date range
      const isQualified = !!matchedQualifiedSegment;
      const stayText = isQualified
        ? `🕒 Stayed <b>${matchedQualifiedSegment?.stayBeforeMinutes ?? stay.duration} min</b> (qualified stay)`
        : `🕒 Stayed <b>${stay.duration} min</b> (below threshold)`;

      // Marker styling
      const el = document.createElement("div");
      el.className = "merged-marker";
      el.style.width = isQualified ? "12px" : "10px";
      el.style.height = isQualified ? "12px" : "10px";
      el.style.backgroundColor = isQualified ? "#22C55E" : "#A1A1AA"; // green = qualified, gray = short
      el.style.border = "2px solid white";
      el.style.borderRadius = "50%";
      el.style.cursor = "pointer";
      el.style.opacity = "0.9";
      el.style.boxShadow = "0 0 6px rgba(0,0,0,0.4)";
      el.style.zIndex = "9999";

      const popup = new mapboxgl.Popup({ offset: 10, closeButton: false }).setHTML(
        `<div style="font-size:12px;line-height:1.4;">${stayText}</div>`
      );

      const marker = new mapboxgl.Marker(el)
        .setLngLat([stay.lng, stay.lat])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener("mouseenter", () => marker.togglePopup());
      el.addEventListener("mouseleave", () => marker.togglePopup());
    });



    // 🔹 Add all gray merged polylines
    if (mergedFeatures.length > 0) {
      map.current.addSource("merged-lines", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: mergedFeatures,
        },
      });

      map.current.addLayer({
        id: "merged-lines",
        type: "line",
        source: "merged-lines",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#A1A1AA", // light gray
          "line-width": 2,
          "line-dasharray": [1.5, 1.5],
          "line-opacity": 0.4,

        },
      });
    }

    return () => {
      const oldMarkers = document.getElementsByClassName("merged-marker");
      Array.from(oldMarkers).forEach(el => el.remove());
      if (map.current) {
        if (map.current.getLayer("merged-lines")) map.current.removeLayer("merged-lines");
        if (map.current.getSource("merged-lines")) map.current.removeSource("merged-lines");
      }
    };
  }, [rawPoints, stayDurationFilter, shortStays, map]);


  return (
    <div
      className={`fixed bottom-0 transition-all duration-300 bg-[#6b6f1d]/95 backdrop-blur-md shadow-2xl rounded-t-2xl border-t-2 border-white/20 max-h-[240px] z-30`}
      style={{
        width: "810px", // ✅ Solid fixed width
        left: sidebarCollapsed ? "50%" : "calc(50% - 2rem)", // move slightly left when sidebar expands
        transform: "translateX(-50%)", // keep perfectly centered relative to left
      }}
    >


      {/* Header */}
      <div className="flex justify-between items-center p-2.5 border-b border-white/20">
        <div className="flex items-center gap-4 w-full">
          {/* Left side: Engineer Info + Filters together */}
          <div className="flex items-center gap-3">
            {/* Engineer avatar and name */}
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {selectedEngineer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-white font-semibold text-xs leading-tight">
                {selectedEngineer.name}
              </h3>
              <p className="text-white/70 text-xs">{selectedEngineer.status}</p>
            </div>

            {/* ✅ Filters now beside the name */}
            <div className="flex items-center gap-3 ml-3">
              {/* ✅ Stay Duration Filter */}
              <div className="flex items-center gap-2 border-l border-white/20 pl-3">
                <div className="flex flex-col">
                  <label className="text-xs text-white/70 whitespace-nowrap">Min Stay Before Drive:</label>
                  <label className="text-xs text-white/70 whitespace-nowrap">(Minutes)</label>
                </div>
                <input
                  type="number"
                  className="input input-xs bg-white/10 border-white/20 text-white w-16 focus:outline-none focus:border-yellow-500"
                  placeholder="0"
                  min="0"
                  max="1440"
                  value={stayDurationFilter || ''}
                  onChange={async (e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null;
                    if (value !== null && value < 0) return;

                    setStayDurationFilter(value);

                    // 🔥 When filter is cleared or reduced, force full refresh
                    if (value === null || value === 0 || value < (stayDurationFilter ?? 0)) {
                      console.log("🔄 Rebuilding from raw points due to filter reset...");
                      setHistoryData([]); // clear current drives
                      if (!isLoading) await handleRefreshHistory();
                    }
                  }}

                  onKeyPress={(e) => {
                    if (!/[0-9]/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
                {/* {stayDurationFilter && (
                <button
                  className="btn btn-xs btn-ghost text-white/50 hover:text-white p-0 min-h-0 h-5"
                  onClick={() => setStayDurationFilter(null)}
                  title="Clear filter"
                >
                  ✕
                </button>
              )} */}
              </div>

              {/* ✅ Date Range Filter (Stacked Layout) */}
              <div className="flex flex-col gap-1 items-start justify-center border-l border-white/20 pl-3">
                <label className="text-xs text-white/70 whitespace-nowrap">Date Range:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    className="input input-xs bg-white/10 border-white/20 text-white focus:outline-none focus:border-yellow-500"
                    value={dateRange.startDate}
                    onChange={async (e) => {
                      const newRange = { ...dateRange, startDate: e.target.value };
                      setDateRange(newRange);
                      if (!isLoading) await handleRefreshHistory(); // ✅ auto-refresh when date changes
                    }}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <span className="text-white/50 text-xs">to</span>
                  <input
                    type="date"
                    className="input input-xs bg-white/10 border-white/20 text-white focus:outline-none focus:border-yellow-500"
                    value={dateRange.endDate || dateRange.startDate} // ✅ Default to startDate kung blank
                    onChange={async (e) => {
                      const newEndDate = e.target.value || dateRange.startDate; // ✅ Fallback
                      const newRange = { ...dateRange, endDate: newEndDate };
                      setDateRange(newRange);
                      if (!isLoading) await handleRefreshHistory();
                    }}
                    min={dateRange.startDate}
                    max={new Date().toISOString().split('T')[0]}
                    required // ✅ HTML5 validation
                  />
                </div>
              </div>

              {/* ✅ Action Buttons - Moved here (no margin-left) */}
              <div className="flex items-center gap-2 border-l border-white/20 pl-3">
                <button onClick={handleRefreshHistory} className="btn btn-sx btn-circle bg-white/10 hover:bg-white/20 border-none text-white" title="Refresh">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m6 0a6 6 0 10-6 6m6-6a6 6 0 01-6-6" />
                  </svg>
                </button>
                <button
                  onClick={handleExportToExcel}
                  className="btn btn-sx btn-circle bg-white/10 hover:bg-white/20 border-none text-white"
                  title="Export to Excel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                    strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 16v4m0 0H8m4 0h4m-4-4V4m0 12L8 8m4 8l4-8" />
                  </svg>
                </button>

                <button
                  onClick={() => setLocalCollapsed(!localCollapsed)}
                  className="btn btn-sx btn-circle bg-white/10 hover:bg-white/20 border-none text-white"
                  title={localCollapsed ? "Expand" : "Collapse"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`w-4 h-4 transition-transform duration-300 ${localCollapsed ? "rotate-180" : ""
                      }`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>

                <button
                  onClick={onClose}
                  className="btn btn-sx btn-circle bg-white/10 hover:bg-red-500/50 border-none text-white"
                  title="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      <div
        className={`transition-all duration-300 overflow-hidden ${localCollapsed ? "max-h-0" : "max-h-[280px]"
          }`}
      >

        {/* Horizontal Scrollable Container */}
        <div
          ref={scrollContainerRef}
          onWheel={handleWheelScroll}
          className="flex overflow-x-auto space-x-4 p-4 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent"
        >
          {isLoading ? (

            <div className="flex-grow flex items-start justify-center pt-2 min-h-[160px] bg-white/10 rounded-lg p-4 text-center text-white/70 transition-all duration-300">
              {!isLoading && stayDurationFilter && stayDurationFilter > 0 && historyData.length > 0 && (
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white/10 text-white/80 text-xs px-3 py-1.5 rounded-lg shadow-md border border-white/20 backdrop-blur-md">
                  🟢 Showing drives that occurred after a stay of ≥ {stayDurationFilter} minutes
                </div>
              )}


              <span className="loading loading-spinner loading-lg text-white mb-2"></span>
              <p className="text-white/70 text-sm">Loading activities...</p>
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex-grow flex items-center justify-center bg-white/10 rounded-lg p-4 text-center text-white/70">
              <div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-12 h-12 mx-auto mb-2 opacity-50"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                  />
                </svg>

                {/* ✅ Dynamic message */}
                <p className="font-semibold text-sm">
                  {stayDurationFilter && stayDurationFilter > 0
                    ? `No stay duration lasted for ${stayDurationFilter} minutes.`
                    : "No activity data available"}
                </p>

                {/* Optional small helper line */}
                <p className="text-xs mt-1">
                  {stayDurationFilter && stayDurationFilter > 0
                    ? "Try lowering your minimum stay filter to see results."
                    : "This engineer hasn't logged any activities yet."}
                </p>
              </div>
            </div>
          ) : (
            historyData
              .slice()              // clone array to avoid mutating
              .reverse()
              .filter((item) => {
                if (filter === "all") return true;
                if (filter === "drive") return item.type === "drive";
                if (filter === "stop") return item.type === "stop";
                return true;
              })
              // ✅ APPLY DATE RANGE FILTER FIRST
              .filter((item) => {
                // ✅ SAFEST: Use regex to extract YYYY-MM-DD from any format
                const dateMatch = item.startTime.match(/(\d{4}-\d{2}-\d{2})/);
                if (!dateMatch) {
                  console.warn("⚠️ Invalid timestamp format:", item.startTime);
                  return false;
                }

                const itemDate = dateMatch[1]; // "2025-11-13"
                const matches = itemDate >= dateRange.startDate && itemDate <= dateRange.endDate;

                console.log(`📅 Card: ${itemDate}, Filter: ${dateRange.startDate} to ${dateRange.endDate}, Match: ${matches}`);

                return matches;
              })
              // ✅ THEN APPLY STAY DURATION FILTER (first item in date range is always included)
              .filter((item, index) => {
                if (stayDurationFilter === null) return true;

                // ✅ Always include the very first drive (anchor 08:00)
                //if (index === 0 && item.type === "drive") return true;

                const stayBefore = (item as any).stayBeforeMinutes ?? 0;
                // keep drive segments if stay before >= threshold OR it starts at anchor
                return stayBefore >= stayDurationFilter || item.startTime.includes("08:00");
              })



              .map((item) => (
                <div
                  key={item.id}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const tooltipEl = document.getElementById("floating-tooltip");
                    if (tooltipEl) {
                      tooltipEl.style.display = "block";
                      tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
                      tooltipEl.style.top = `${rect.top - 10}px`;
                      if (item.type === "drive") {
                        tooltipEl.textContent = `🟢 A: ${item.startAddress || "Unknown"}\n🔴 B: ${item.endAddress || "Unknown"}`;
                      } else if (item.type === "stop") {
                        tooltipEl.textContent = `📍 ${item.address || "Unknown Location"}`;
                      }

                    }
                  }}
                  onMouseLeave={() => {
                    const tooltipEl = document.getElementById("floating-tooltip");
                    if (tooltipEl) tooltipEl.style.display = "none";
                  }}
                  //TODO: Improve styling for selected state
                  className={`${item.type === "drive"
                    ? "bg-[#2C2F00]/80 hover:bg-[#40450A]/80"
                    : "bg-[#3A2F00]/80 hover:bg-[#4A3F0A]/80"
                    } transition-all cursor-pointer rounded-lg border border-white/10 p-3 w-70 h-30 flex-shrink-0 shadow-md hover:shadow-lg ${selectedActivityId === item.id ? "ring-2 ring-yellow-400" : ""
                    }`}


                  onClick={async (e) => {
                    setSelectedActivityId(item.id);
                    e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center" });
                    if (!map.current) return;

                    // 🧹 clear old layers/sources (route + markers)
                    const ids = ["activity-route", "activity-start", "activity-end", "activity-stop"];
                    for (const id of ids) {
                      if (map.current.getLayer(id)) map.current.removeLayer(id);
                      if (map.current.getSource(id)) map.current.removeSource(id);
                    }

                    // DRIVE logic
                    if (item.type === "drive") {
                      try {
                        let coords: [number, number][];
                        if (item.routePathJson) {
                          coords = JSON.parse(item.routePathJson);
                        } else if (item.startLat && item.startLng && item.endLat && item.endLng) {
                          coords = [
                            [item.startLng, item.startLat],
                            [item.endLng, item.endLat],
                          ];
                        } else return;

                        const rawLine = turf.lineString(coords);
                        const toleranceMeters = 20;
                        const toleranceDeg = mToDeg(toleranceMeters);
                        let simplified = turf.simplify(rawLine, {
                          tolerance: toleranceDeg,
                          highQuality: false,
                          mutate: false,
                        });

                        if (!simplified.geometry.coordinates?.length || simplified.geometry.coordinates.length < 2) {
                          simplified = rawLine;
                        }

                        map.current.addSource("activity-route", {
                          type: "geojson",
                          lineMetrics: true,
                          data: simplified,
                        });

                        map.current.addLayer({
                          id: "activity-route",
                          type: "line",
                          source: "activity-route",
                          layout: { "line-join": "round", "line-cap": "round" },
                          paint: {
                            "line-width": 5,
                            "line-opacity": 0.9,
                            "line-gradient": [
                              "interpolate",
                              ["linear"],
                              ["line-progress"],
                              0,
                              "#0000FF",
                              1,
                              "#0000FF",
                            ],
                          },
                        });

                        const path = simplified.geometry.coordinates as [number, number][];
                        const start = path[0];
                        const end = path[path.length - 1];

                        map.current.addSource("activity-start", {
                          type: "geojson",
                          data: turf.point(start),
                        });
                        map.current.addLayer({
                          id: "activity-start",
                          type: "circle",
                          source: "activity-start",
                          paint: {
                            "circle-radius": 7,
                            "circle-color": "#22C55E",
                            "circle-stroke-width": 2,
                            "circle-stroke-color": "#fff",
                          },
                        });

                        map.current.addSource("activity-end", {
                          type: "geojson",
                          data: turf.point(end),
                        });
                        map.current.addLayer({
                          id: "activity-end",
                          type: "circle",
                          source: "activity-end",
                          paint: {
                            "circle-radius": 7,
                            "circle-color": "#EF4444",
                            "circle-stroke-width": 2,
                            "circle-stroke-color": "#fff",
                          },
                        });

                        const bounds = path.reduce(
                          (b, c) => b.extend(c as [number, number]),
                          new mapboxgl.LngLatBounds(path[0], path[0])
                        );
                        map.current.fitBounds(bounds, { padding: 80, maxZoom: 15 });
                      } catch (err) {
                        console.error("Failed to render simplified route:", err);
                      }
                    }// STOP / STAY logic
                    // STOP / STAY logic
                    else if (item.type === "stop") {
                      try {
                        let lat = item.startLat ?? item.lat ?? null;
                        let lng = item.startLng ?? item.lng ?? null;


                        // 🧭 Fallback to geocoding if no coordinates are available
                        if ((!lat || !lng) && item.address) {

                          const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                            item.address
                          )}.json?access_token=pk.eyJ1IjoiYmFzaWwxLTIzIiwiYSI6ImNtZWFvNW43ZTA0ejQycHBtd3dkMHJ1bnkifQ.Y-IlM-vQAlaGr7pVQnug3Q`;

                          const response = await fetch(geoUrl);
                          const data = await response.json();

                          if (data.features && data.features.length > 0) {
                            const [lngFetched, latFetched] = data.features[0].center;
                            lat = latFetched;
                            lng = lngFetched;

                          } else {
                            console.warn("⚠️ No coordinates found for address:", item.address);
                            return;
                          }
                        }

                        if (!lat || !lng) {
                          console.warn("⚠️ Still no coordinates after geocoding:", item);
                          return;
                        }

                        const stopCoords: [number, number] = [lng, lat];

                        // 🧹 Remove old marker
                        if (map.current.getLayer("activity-stop")) map.current.removeLayer("activity-stop");
                        if (map.current.getSource("activity-stop")) map.current.removeSource("activity-stop");

                        // 🟡 Add stay marker
                        map.current.addSource("activity-stop", {
                          type: "geojson",
                          data: turf.point(stopCoords),
                        });
                        map.current.addLayer({
                          id: "activity-stop",
                          type: "circle",
                          source: "activity-stop",
                          paint: {
                            "circle-radius": 9,
                            "circle-color": "#FACC15",
                            "circle-stroke-width": 2,
                            "circle-stroke-color": "#fff",
                          },
                        });

                        // Popup for address
                        new mapboxgl.Popup({ offset: 25 })
                          .setLngLat(stopCoords)
                          .setHTML(`<b>📍 ${item.address}</b>`)
                          .addTo(map.current);

                        // Fly to that point
                        map.current.flyTo({
                          center: stopCoords,
                          zoom: 17,
                          speed: 1.3,
                          curve: 1.1,
                        });

                      } catch (err) {
                        console.error("🔥 Failed to render stop marker:", err);
                      }
                    }


                  }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center ${item.type === "drive" ? "bg-blue-500/80" : "bg-yellow-500/80"
                          }`}
                      >
                        {item.type === "drive" ? "🚗" : "🅿️"}
                      </div>

                      {item.type === "drive" && (
                        <span className="text-white font-semibold text-sm truncate">
                          {(() => {
                            const distanceKm = parseFloat(item.distance?.replace(' km', '') || '0');
                            if (distanceKm < 1) {
                              const meters = Math.round(distanceKm * 1000);
                              return `${meters} m`;
                            }
                            return item.distance || "0 km";
                          })()}
                        </span>
                      )}

                    </div>

                    {/* Time Range + AM/PM Indicator */}
                    <span className="text-[12px] text-white/60">
                      {item.timeRange}{" "}
                      {(() => {
                        const match = item.timeRange?.match(/(AM|PM)/gi);
                        if (match && match.length > 1 && match[0] !== match[1]) {
                          return (
                            <span className="ml-1 text-yellow-300 font-semibold">
                              AM → PM
                            </span>
                          );
                        } else if (match && match.length > 0) {
                          return (
                            <span className="ml-1 text-yellow-300 font-semibold">
                              {match[0].toUpperCase()}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </span>
                  </div>

                  {/* Details */}
                  {item.type === "drive" ? (
                    <div className="text-[11px] text-white/70 space-y-0.7">
                      <div className="truncate">
                        <span className="text-green-400">A:</span> {item.startAddress}
                      </div>
                      <div className="truncate">
                        <span className="text-red-400">B:</span> {item.endAddress}
                      </div>
                      <div className="grid grid-cols-2 text-[10px] text-white/80 pt-1 text-[10px] space-y-0.5 text-white/80">
                        <div className="flex justify-between">

                          <span>⏱ Duration: {
                            (() => {
                              if (!item.timeRange) return "—";
                              const match = item.timeRange.match(/(\d{1,2}:\d{2}\s?[APMapm]{2})\s*-\s*(\d{1,2}:\d{2}\s?[APMapm]{2})/);
                              if (!match) return "—";

                              const [_, startStr, endStr] = match;
                              const start = new Date(`1970-01-01T${convertTo24Hour(startStr)}:00`);
                              const end = new Date(`1970-01-01T${convertTo24Hour(endStr)}:00`);

                              let diffMs = end.getTime() - start.getTime();
                              if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // Handle crossing midnight

                              const mins = Math.floor(diffMs / 60000);
                              const hours = Math.floor(mins / 60);
                              const remainingMins = mins % 60;

                              if (hours === 0 && remainingMins === 0) return "00:01";
                              if (hours === 0) return `00:${remainingMins.toString().padStart(2, "0")}`;
                              return `${hours.toString().padStart(2, "0")}:${remainingMins.toString().padStart(2, "0")}`;
                            })()
                          }
                          </span>

                        </div>

                      </div>
                      {stayDurationFilter && stayDurationFilter > 0 &&
                        item.stayBeforeMinutes !== undefined && item.stayBeforeMinutes >= stayDurationFilter && (
                          <div className="text-[10px] text-yellow-400 mt-1 italic">
                            Stayed {item.stayBeforeMinutes} min{item.stayBeforeMinutes > 1 ? "s" : ""} before this drive
                          </div>
                        )}




                    </div>
                  ) : (
                    <div className="text-[11px] text-white/70 space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">🅿️ Stay</span>
                        <span>{item.timeRange ? `${item.timeRange} min` : "—"}</span>
                      </div>
                      <div className="truncate">
                        📍 {item.address || "Unknown location"}
                      </div>
                    </div>
                  )

                  }
                </div>

              ))
          )}
        </div>
      </div>
    </div>
  );
};
export default LocationHistoryPanel;
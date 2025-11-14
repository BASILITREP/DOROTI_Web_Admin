// utils/reverseGeocode.ts
import axios from "axios";

/**
 * Performs reverse geocoding using Mapbox API.
 * Converts latitude and longitude into a readable location name and address.
 *
 * @param lat Latitude
 * @param lon Longitude
 * @returns {Promise<{ locationName: string; address: string }>}
 */

// 🌟 Global in-memory cache (simple & fast)
const reverseGeoCache = new Map<string, { locationName: string; address: string }>();

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ locationName: string; address: string }> {
  if (!lat || !lon) {
    return { locationName: "Unknown", address: "Unknown Address" };
  }

  // Create stable cache key (rounded to 6 decimals)
  const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;

  // 🟢 Return instantly if cached
  if (reverseGeoCache.has(key)) {
    return reverseGeoCache.get(key)!;
  }

  const apiKey =
    "pk.eyJ1IjoiYmFzaWwxLTIzIiwiYSI6ImNtZWFvNW43ZTA0ejQycHBtd3dkMHJ1bnkifQ.Y-IlM-vQAlaGr7pVQnug3Q";

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=poi,address&access_token=${apiKey}`;

  try {
    const response = await axios.get(url);

    if (!response.data?.features?.length) {
      const fallback = { locationName: "Unknown", address: "Unknown Address" };
      reverseGeoCache.set(key, fallback);
      return fallback;
    }

    const feature = response.data.features[0];

    const result = {
      locationName: feature.text || "Unknown",
      address: feature.place_name || "Unknown Address",
    };

    // Save to cache for next calls
    reverseGeoCache.set(key, result);

    return result;
  } catch (err) {
    console.error(`🔥 Reverse geocoding crashed for ${lat},${lon}`, err);

    const fallback = { locationName: "Unknown", address: "Unknown Address" };
    reverseGeoCache.set(key, fallback);
    return fallback;
  }
}


/**
 * Calculates distance between two coordinates using the Haversine formula.
 * Returns kilometers (same as your C# version).
 */
export function haversineDistance(
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number }
): number {
  const R = 6371; // km
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

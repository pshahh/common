/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of point 1 (in degrees)
 * @param lon1 Longitude of point 1 (in degrees)
 * @param lat2 Latitude of point 2 (in degrees)
 * @param lon2 Longitude of point 2 (in degrees)
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
/**
 * Format distance for display (in miles)
 * @param distanceKm Distance in kilometers (from calculateDistance)
 * @returns Formatted string like "1.2 miles" or "nearby"
 */
export function formatDistance(distanceKm: number): string {
  const distanceMiles = distanceKm * 0.621371;
  
  if (distanceMiles < 0.1) {
    return 'nearby';
  } else if (distanceMiles < 10) {
    return `${distanceMiles.toFixed(1)} miles`;
  } else {
    return `${Math.round(distanceMiles)} miles`;
  }
}

/**
 * Sort posts by distance from user location
 * Posts without coordinates are placed at the end
 */
export function sortByDistance<T extends { latitude: number | null; longitude: number | null }>(
  posts: T[],
  userLat: number,
  userLon: number
): T[] {
  return [...posts].sort((a, b) => {
    // Posts without coordinates go to the end
    const aHasCoords = a.latitude !== null && a.longitude !== null;
    const bHasCoords = b.latitude !== null && b.longitude !== null;
    
    if (!aHasCoords && !bHasCoords) return 0;
    if (!aHasCoords) return 1;
    if (!bHasCoords) return -1;
    
    const distA = calculateDistance(userLat, userLon, a.latitude!, a.longitude!);
    const distB = calculateDistance(userLat, userLon, b.latitude!, b.longitude!);
    
    return distA - distB;
  });
}

/**
 * Get distance from user to a post
 * @returns Distance in km or null if post location is missing
 */
export function getDistanceToPost(
  post: { latitude: number | null; longitude: number | null },
  userLat: number,
  userLon: number
): number | null {
  if (post.latitude === null || post.longitude === null) {
    return null;
  }
  
  return calculateDistance(userLat, userLon, post.latitude, post.longitude);
}
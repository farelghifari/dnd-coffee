import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLocalYYYYMMDD(d?: Date | string | number) {
  const date = d ? new Date(d) : new Date();
  
  // Use local components to avoid ISO timezone shifting
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Calculates distance between two coordinates in meters using the Haversine formula
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function isPastDate(dateStr: string) {
  const today = getLocalYYYYMMDD();
  return dateStr < today;
}

/**
 * Checks if a shift at a specific date and start time is "locked" (already started)
 */
export function isShiftLocked(dateStr: string, startTime: string) {
  if (!dateStr || !startTime) return false;
  
  const now = new Date();
  const todayStr = getLocalYYYYMMDD(now);
  
  // 1. If date is definitely in the past
  if (dateStr < todayStr) return true;
  
  // 2. If date is in the future
  if (dateStr > todayStr) return false;
  
  // 3. If it's today, compare total minutes from midnight
  try {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    // Parse shift start time (handles HH:mm or HH:mm:ss)
    const timeParts = startTime.split(':');
    const shiftStartH = parseInt(timeParts[0], 10);
    const shiftStartM = parseInt(timeParts[1], 10);
    const shiftStartMins = shiftStartH * 60 + shiftStartM;
    
    // Locked if current time reached or passed shift start time
    return currentMins >= shiftStartMins;
  } catch (e) {
    console.error("Error calculating shift lock:", e);
    return false;
  }
}
/**
 * Returns a simple fingerprint for the current browser/device
 */
export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return 'server';
  
  const ua = window.navigator.userAgent;
  const platform = (window.navigator as any).platform || 'unknown';
  
  // Create a simple readable fingerprint
  // Format: Platform | Browser (truncated)
  const browserMatch = ua.match(/(chrome|safari|firefox|edge|opera)/i);
  const browserName = browserMatch ? browserMatch[0] : 'Browser';
  
  return `${platform} | ${browserName}`;
}

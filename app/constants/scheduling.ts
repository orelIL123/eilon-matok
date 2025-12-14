/**
 * Scheduling system constants
 * All time slot calculations and validations should use these constants
 */

// Global slot size in minutes - all scheduling is based on this grid
// Changed to 5 minutes to support flexible treatment durations (10, 15, 20, 25, 30, etc.)
export const SLOT_SIZE_MINUTES = 5;

// Time grid points (in minutes from start of hour) - every 5 minutes
// This allows fine-grained scheduling while keeping availability management simple
export const TIME_GRID_POINTS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]; // Every 5 minutes

// Helper function to snap time to the nearest 5-minute grid point
export const snapToGrid = (date: Date): Date => {
  const minutes = date.getMinutes();
  const hours = date.getHours();
  
  // Find the closest 5-minute grid point
  const snappedMinutes = Math.round(minutes / 5) * 5;
  
  const snappedDate = new Date(date);
  if (snappedMinutes >= 60) {
    snappedDate.setHours(hours + 1, 0, 0, 0);
  } else {
    snappedDate.setMinutes(snappedMinutes, 0, 0);
  }
  
  return snappedDate;
};

// Helper function to check if a duration is valid (multiple of 5 minutes, minimum 5)
// This allows flexible treatment durations: 5, 10, 15, 20, 25, 30, etc.
export const isValidDuration = (durationMinutes: number): boolean => {
  return durationMinutes >= 5 && durationMinutes % SLOT_SIZE_MINUTES === 0;
};

// Helper function to get the number of slots needed for a duration
export const getSlotsNeeded = (durationMinutes: number): number => {
  return Math.ceil(durationMinutes / SLOT_SIZE_MINUTES);
};

// Helper function to generate time slots for a given time range
export const generateTimeSlots = (startHour: number, endHour: number): string[] => {
  const slots: string[] = [];
  const dayStartMinutes = startHour * 60;
  const dayEndMinutes = endHour * 60;
  
  // Find the first slot boundary at or after startHour
  const firstSlotMinutes = Math.ceil(dayStartMinutes / SLOT_SIZE_MINUTES) * SLOT_SIZE_MINUTES;
  
  // Generate continuous slot increments (no hour jumps)
  for (let currentMinutes = firstSlotMinutes; currentMinutes < dayEndMinutes; currentMinutes += SLOT_SIZE_MINUTES) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    slots.push(timeString);
  }
  
  return slots;
};

// Helper function to convert time string to minutes from midnight
export const timeStringToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to convert minutes from midnight to time string
export const minutesToTimeString = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Helper function to check if a time string is on the grid (5-minute intervals)
export const isOnGrid = (timeString: string): boolean => {
  const totalMinutes = timeStringToMinutes(timeString);
  // Check if the time is on a 5-minute slot boundary from midnight
  return totalMinutes % SLOT_SIZE_MINUTES === 0;
};

// Helper function to get next grid point
export const getNextGridPoint = (timeString: string): string => {
  const minutes = timeStringToMinutes(timeString);
  const hourMinutes = minutes % 60;
  const hour = Math.floor(minutes / 60);
  
  for (const gridPoint of TIME_GRID_POINTS) {
    if (gridPoint > hourMinutes) {
      return minutesToTimeString(hour * 60 + gridPoint);
    }
  }
  
  // If no grid point found in current hour, go to next hour's first grid point
  return minutesToTimeString((hour + 1) * 60 + TIME_GRID_POINTS[0]);
};

// Helper function to get previous grid point
export const getPreviousGridPoint = (timeString: string): string => {
  const minutes = timeStringToMinutes(timeString);
  const hourMinutes = minutes % 60;
  const hour = Math.floor(minutes / 60);
  
  for (let i = TIME_GRID_POINTS.length - 1; i >= 0; i--) {
    const gridPoint = TIME_GRID_POINTS[i];
    if (gridPoint < hourMinutes) {
      return minutesToTimeString(hour * 60 + gridPoint);
    }
  }
  
  // If no grid point found in current hour, go to previous hour's last grid point
  const prevHour = hour - 1;
  const lastGridPoint = TIME_GRID_POINTS[TIME_GRID_POINTS.length - 1];
  return minutesToTimeString(prevHour * 60 + lastGridPoint);
};

// Helper function to check if a slot fits within day boundaries (end-exclusive)
export const slotFitsInDay = (startTime: string, durationMinutes: number, dayEndHour: number): boolean => {
  const startMinutes = timeStringToMinutes(startTime);
  const dayEndMinutes = dayEndHour * 60;
  const slotEndMinutes = startMinutes + durationMinutes;
  
  return slotEndMinutes <= dayEndMinutes;
};

// Helper function to get valid slots for a treatment duration within day boundaries
export const getValidSlotsForTreatment = (availableSlots: string[], durationMinutes: number, dayEndHour: number): string[] => {
  return availableSlots.filter(slot => slotFitsInDay(slot, durationMinutes, dayEndHour));
};

// Helper function to check if a time range (for blocking) fits within day boundaries
export const timeRangeFitsInDay = (startTime: string, endTime: string, dayEndHour: number): boolean => {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  const dayEndMinutes = dayEndHour * 60;
  
  return startMinutes < dayEndMinutes && endMinutes <= dayEndMinutes;
};

// Utility functions for stable time operations
export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const addMinutes = (hhmm: string, delta: number): string => {
  const t = toMin(hhmm) + delta;
  const h = String(Math.floor(t / 60)).padStart(2, '0');
  const m = String(t % 60).padStart(2, '0');
  return `${h}:${m}`;
};

export const isContiguous = (slots: string[]): boolean => {
  if (slots.length <= 1) return true;
  const s = [...slots].sort((a, b) => toMin(a) - toMin(b));
  for (let i = 1; i < s.length; i++) {
    if (toMin(s[i]) - toMin(s[i - 1]) !== SLOT_SIZE_MINUTES) return false;
  }
  return true;
};

// Local date utilities (avoiding UTC issues)
// CRITICAL FIX: Always use local timezone, never UTC
// When using new Date() after midnight, timezone differences can cause day to shift
// Solution: Always create dates with explicit local time components
export const toYMD = (d: Date): string => {
  // Use local getters (not UTC getters) to ensure local timezone
  const y = d.getFullYear();        // Local year
  const m = d.getMonth() + 1;        // Local month (0-11, so +1)
  const dd = d.getDate();            // Local day of month

  // Ensure 2-digit padding
  const mStr = String(m).padStart(2, '0');
  const ddStr = String(dd).padStart(2, '0');

  return `${y}-${mStr}-${ddStr}`;
};

export const fromYMD = (ymd: string): Date => {
  const [Y, M, D] = ymd.split('-').map(Number);
  // Create date in LOCAL timezone (not UTC)
  // new Date(year, month, day) creates a LOCAL date
  const localDate = new Date(Y, M - 1, D);
  // Set to start of day in LOCAL timezone
  localDate.setHours(0, 0, 0, 0);
  return localDate;
};

export const getDayOfWeekFromYMD = (ymd: string): number => {
  const [Y, M, D] = ymd.split('-').map(Number);
  // Create date in LOCAL timezone and get day of week
  const localDate = new Date(Y, M - 1, D);
  return localDate.getDay(); // 0 = Sunday, 6 = Saturday
};

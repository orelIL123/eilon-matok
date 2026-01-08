import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { collection, getDocs, getFirestore, onSnapshot, query, QuerySnapshot, Timestamp, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  Barber,
  createAppointment,
  createWaitlistEntry,
  getBarberAppointmentsForDay,
  getBarberAvailableSlots,
  getBarbers,
  getCurrentUser,
  getTreatments,
  getUserProfile,
  subscribeToTreatmentsChanges,
  Treatment
} from '../../services/firebase';
import ConfirmationModal from '../components/ConfirmationModal';
import OptimizedImage from '../components/OptimizedImage';
import ScissorsLoader from '../components/ScissorsLoader';
import TopNav from '../components/TopNav';
import { generateTimeSlots, SLOT_SIZE_MINUTES, toMin, toYMD } from '../constants/scheduling';

const { width } = Dimensions.get('window');

// Helper function to format time consistently as HH:MM
const formatTimeSlot = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

interface BookingScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
  onClose?: () => void;
  route?: {
    params?: {
      barberId?: string;
    };
  };
}


const BookingScreen: React.FC<BookingScreenProps> = ({ onNavigate, onBack, onClose, route }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [weeklyAvailability, setWeeklyAvailability] = useState<{ [key: number]: string[] }>({});
  const [dateSpecificAvailability, setDateSpecificAvailability] = useState<{ [date: string]: string[] | null }>({});
  const [availableDates, setAvailableDates] = useState<{ date: Date, isAvailable: boolean, dayOfWeek: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistTimeStart, setWaitlistTimeStart] = useState('09:00');
  const [waitlistTimeEnd, setWaitlistTimeEnd] = useState('18:00');

  const preSelectedBarberId = route?.params?.barberId;

  const loadData = useCallback(async () => {
    try {
      const [barbersData, treatmentsData] = await Promise.all([
        getBarbers(),
        getTreatments(false) // Don't use cache - subscription will handle real-time updates
      ]);

      setBarbers(barbersData);
      setTreatments(treatmentsData);

      // Prefetch all barber images immediately for instant loading using expo-image
      barbersData.forEach(barber => {
        if (barber.image) {
          Image.prefetch(barber.image, 'memory-disk').catch(err => {
            console.warn('Failed to prefetch barber image:', barber.image, err);
          });
        }
      });

      // Prefetch treatment images
      treatmentsData.forEach(treatment => {
        if (treatment.image) {
          Image.prefetch(treatment.image, 'memory-disk').catch(err => {
            console.warn('Failed to prefetch treatment image:', treatment.image, err);
          });
        }
      });

      // If barber is pre-selected, set it and skip to next step
      if (preSelectedBarberId) {
        const preSelectedBarber = barbersData.find(b => b.id === preSelectedBarberId);
        if (preSelectedBarber) {
          setSelectedBarber(preSelectedBarber);
          setCurrentStep(2);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('common.error'), t('errors.load_data_error'));
    } finally {
      setLoading(false);
    }
  }, [preSelectedBarberId]);

  // Removed auto-creation. Customer view now reflects EXACTLY what admin saved.

  const refreshAvailability = async () => {
    if (!selectedBarber) return;

    setRefreshing(true);
    try {
      console.log('🔄 Refreshing availability for barber:', selectedBarber.id);
      console.log('🗓️ TODAY\'S DATE FOR SYNC TEST:', new Date().toLocaleDateString());
      const todayDayOfWeek = new Date().getDay();
      console.log('🗓️ TODAY\'S DAY OF WEEK:', todayDayOfWeek);

      // No auto-creation here. We only read what's in dailyAvailability.

      const db = getFirestore();

      // Load DAILY availability first (has priority) - next 14 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateSpecificSlots: { [date: string]: string[] | null } = {};

      for (let i = 0; i <= 14; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dateStr = toYMD(checkDate); // CRITICAL FIX: Use toYMD to avoid UTC timezone issues

        // Query for ANY dailyAvailability record (not just isAvailable=true)
        const dailyQuery = query(
          collection(db, 'dailyAvailability'),
          where('barberId', '==', selectedBarber.id),
          where('date', '==', dateStr)
        );

        const dailySnapshot = await getDocs(dailyQuery);
        dailySnapshot.docs.forEach(doc => {
          const data = doc.data();

          if (data.isAvailable === false) {
            // Explicitly unavailable - mark as null to override weekly
            dateSpecificSlots[dateStr] = null;
            console.log('🚫 DATE EXPLICITLY UNAVAILABLE:', dateStr);
          } else if (data.isAvailable && data.availableSlots && Array.isArray(data.availableSlots)) {
            dateSpecificSlots[dateStr] = data.availableSlots;
            console.log('✅ DATE-SPECIFIC: Found slots for', dateStr, ':', data.availableSlots);
          }
        });
      }

      // Load WEEKLY availability as fallback
      const weeklyQuery = query(
        collection(db, 'availability'),
        where('barberId', '==', selectedBarber.id),
        where('isAvailable', '==', true)
      );

      const weeklySnapshot = await getDocs(weeklyQuery);
      const weeklySlots: { [key: number]: string[] } = {};

      weeklySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const dayOfWeek = data.dayOfWeek;
        console.log('🔍 WEEKLY FALLBACK: docId=' + doc.id + ', dayOfWeek=' + dayOfWeek);

        if (data.isAvailable) {
          let slots = [];

          if (data.availableSlots && Array.isArray(data.availableSlots)) {
            slots = data.availableSlots;
            console.log('✅ WEEKLY FALLBACK: Using slots for dayOfWeek', dayOfWeek, ':', slots);
          } else if (data.startTime && data.endTime) {
            const startTime = data.startTime;
            const endTime = data.endTime;
            const [startHour] = startTime.split(':').map(Number);
            const [endHour] = endTime.split(':').map(Number);
            slots = generateTimeSlots(startHour, endHour);
            console.log('⚠️ Generated fallback slots from time range:', slots);
          }

          if (slots.length > 0) {
            weeklySlots[dayOfWeek] = [...slots];
          }
        }
      });

      // NEW APPROACH: We now work ONLY with daily availability, no more weekly!
      // Build availability per dayOfWeek from the CURRENT date-specific slots
      const finalWeeklySlots: { [key: number]: string[] } = {};

      for (let i = 0; i <= 14; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dateStr = toYMD(checkDate); // CRITICAL FIX: Use toYMD to avoid UTC timezone issues
        const dayOfWeek = checkDate.getDay();

        // ONLY use date-specific slots (no weekly fallback!)
        if (dateStr in dateSpecificSlots) {
          const dateSlots = dateSpecificSlots[dateStr];

          if (dateSlots === null) {
            // Explicitly unavailable
            console.log(`🚫 ${dateStr} (${dayOfWeek}) explicitly UNAVAILABLE`);
            // Don't add to finalWeeklySlots
          } else if (dateSlots && dateSlots.length > 0) {
            // Use this date's slots for this dayOfWeek
            // NOTE: If there are multiple same days with different slots, last one wins
            // This is OK because each specific date will be checked individually
            finalWeeklySlots[dayOfWeek] = dateSlots;
            console.log(`✅ ${dateStr} (${dayOfWeek}): ${dateSlots.length} slots from dailyAvailability`);
          }
        } else {
          // No data for this date - mark as unavailable
          console.log(`⚠️ ${dateStr} (${dayOfWeek}): No dailyAvailability found`);
        }
      }

      // Remove duplicates and sort for each day
      Object.keys(finalWeeklySlots).forEach(day => {
        finalWeeklySlots[parseInt(day)] = [...new Set(finalWeeklySlots[parseInt(day)])].sort();
      });

      console.log('✅ Refreshed availability (DAILY-ONLY model):', finalWeeklySlots);
      console.log('📊 Date-specific slots loaded:', Object.keys(dateSpecificSlots).length, 'dates');

      // Save both for backwards compatibility
      setWeeklyAvailability(finalWeeklySlots);
      setDateSpecificAvailability(dateSpecificSlots); // CRITICAL: Store date-specific data!

      // Update available dates
      const dates = generateAvailableDates();
      console.log('📅 Generated available dates after refresh:', dates.map(d => ({
        date: toYMD(d.date), // CRITICAL FIX: Use toYMD to avoid timezone issues
        dayOfWeek: d.dayOfWeek,
        isAvailable: d.isAvailable
      })));
      setAvailableDates(dates);

      // If we have a selected date and treatment, update available times
      if (selectedDate && selectedTreatment) {
        const slots = await generateAvailableSlots(selectedBarber.id, selectedDate, selectedTreatment.duration);
        const timeStrings = slots.map(slot => formatTimeSlot(slot));
        setAvailableTimes(timeStrings);
      }

      Alert.alert('עודכן', 'הזמינות עודכנה בהצלחה!');
    } catch (error) {
      console.error('Error refreshing availability:', error);
      Alert.alert('שגיאה', 'שגיאה בעדכון הזמינות');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen to availability changes in real-time (DAILY AVAILABILITY)
  useEffect(() => {
    if (selectedBarber) {
      console.log('🔔 Setting up DAILY availability listener for barber:', selectedBarber.id);

      const db = getFirestore();
      const dailyQuery = query(
        collection(db, 'dailyAvailability'),
        where('barberId', '==', selectedBarber.id)
      );

      // Real-time listener for dailyAvailability changes
      const unsubscribe = onSnapshot(dailyQuery, async (snapshot: QuerySnapshot) => {
        console.log('📡 Daily availability updated! Processing', snapshot.docs.length, 'documents');

        // No auto-creation here. Only reflect existing dailyAvailability.

        // Rebuild dateSpecificAvailability from snapshot
        const dateSpecificSlots: { [date: string]: string[] | null } = {};

        snapshot.docs.forEach(doc => {
          const data = doc.data();

          if (data.date) {
            if (data.isAvailable === false) {
              // Explicitly unavailable
              dateSpecificSlots[data.date] = null;
              console.log('🚫 Real-time: Date explicitly unavailable:', data.date);
            } else if (data.isAvailable && data.availableSlots && Array.isArray(data.availableSlots)) {
              dateSpecificSlots[data.date] = data.availableSlots;
              console.log('✅ Real-time: Date-specific slots for', data.date, ':', data.availableSlots.length, 'slots');
            }
          }
        });

        console.log('📊 Real-time: Updated dateSpecificAvailability with', Object.keys(dateSpecificSlots).length, 'dates');
        setDateSpecificAvailability(dateSpecificSlots);

        // Update available dates
        const dates = generateAvailableDates();
        console.log('📅 Real-time: Regenerated available dates');
        setAvailableDates(dates);

        // If we have a selected date and treatment, update available times
        if (selectedDate && selectedTreatment) {
          console.log('🔄 Real-time: Regenerating available times for selected date');
          generateAvailableSlots(selectedBarber.id, selectedDate, selectedTreatment.duration).then(slots => {
            const timeStrings = slots.map(slot => formatTimeSlot(slot));
            console.log('🔄 Real-time: Updated available times:', timeStrings.length, 'slots');
            setAvailableTimes(timeStrings);
          });
        }
      });

      return () => {
        console.log('🔕 Unsubscribing from daily availability changes');
        unsubscribe();
      };
    }
  }, [selectedBarber, selectedDate, selectedTreatment]);

  // Listen to appointments changes in real-time (for immediate slot updates on cancellations)
  useEffect(() => {
    if (selectedBarber && selectedDate && selectedTreatment) {
      console.log('🔔 Setting up appointments listener for barber:', selectedBarber.id);

      const db = getFirestore();

      // Listen to all appointments for this barber
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('barberId', '==', selectedBarber.id),
        where('status', 'in', ['confirmed', 'pending'])
      );

      const unsubscribe = onSnapshot(appointmentsQuery, async (snapshot: QuerySnapshot) => {
        console.log('📡 Appointments updated! Processing', snapshot.docs.length, 'appointments');

        // Regenerate available times for the selected date
        const slots = await generateAvailableSlots(selectedBarber.id, selectedDate, selectedTreatment.duration);
        const timeStrings = slots.map(slot => formatTimeSlot(slot));
        console.log('🔄 Real-time appointments: Updated available times:', timeStrings.length, 'slots');
        setAvailableTimes(timeStrings);
      });

      return () => {
        console.log('🔕 Unsubscribing from appointments changes');
        unsubscribe();
      };
    }
  }, [selectedBarber, selectedDate, selectedTreatment]);

  // Listen to treatments changes in real-time
  useEffect(() => {
    console.log('🔔 Setting up treatments listener');

    const unsubscribe = subscribeToTreatmentsChanges((treatments) => {
      console.log('📡 Treatments updated:', treatments.length, 'treatments');
      setTreatments(treatments);
    });

    return () => {
      console.log('🔕 Unsubscribing from treatments changes');
      unsubscribe();
    };
  }, []);

  // Check if a slot is available (no overlap with existing appointments)
  function isSlotAvailable(slotStart: Date, slotDuration: number, appointments: any[]) {
    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

    console.log('Checking slot availability:', {
      slotStart: `${slotStart.getHours()}:${slotStart.getMinutes().toString().padStart(2, '0')}`,
      slotDuration,
      totalAppointments: appointments.length
    });

    for (const appt of appointments) {
      try {
        // Handle Firestore Timestamp objects
        let apptStart: Date;
        if (appt.date && typeof appt.date.toDate === 'function') {
          // Firestore Timestamp
          apptStart = appt.date.toDate();
        } else if (appt.date) {
          // Regular date string or number
          apptStart = new Date(appt.date);
        } else if (appt.time) {
          // Fallback to time field
          apptStart = new Date(appt.time);
        } else {
          console.warn('Appointment missing date/time:', appt);
          continue;
        }

        // Use the actual duration from the appointment
        // IMPORTANT: If appointment doesn't have duration, it means it's an old appointment
        // We should use a reasonable default, but ideally all appointments should have duration
        // For old appointments, use 30 minutes as default (most common treatment duration)
        const apptDuration = appt.duration || 30;
        const apptEnd = new Date(apptStart.getTime() + apptDuration * 60000);

        console.log('Appointment duration check:', {
          apptId: appt.id,
          hasDuration: !!appt.duration,
          duration: apptDuration,
          apptStart: `${apptStart.getHours()}:${apptStart.getMinutes().toString().padStart(2, '0')}`,
          apptEnd: `${apptEnd.getHours()}:${apptEnd.getMinutes().toString().padStart(2, '0')}`
        });

        // Check for overlap - if any part of the slot overlaps with appointment
        const hasOverlap = slotStart < apptEnd && slotEnd > apptStart;

        if (hasOverlap) {
          console.log('❌ Slot blocked by appointment:', {
            slotTime: `${slotStart.getHours()}:${slotStart.getMinutes().toString().padStart(2, '0')}`,
            apptTime: `${apptStart.getHours()}:${apptStart.getMinutes().toString().padStart(2, '0')}`,
            apptDuration,
            apptStatus: appt.status,
            apptId: appt.id
          });
          return false;
        }
      } catch (error) {
        console.error('Error processing appointment:', appt, error);
        continue;
      }
    }

    console.log('✅ Slot is available');
    return true;
  }

  // Generate available slots for the selected barber, date, and treatment duration
  async function generateAvailableSlots(barberId: string, date: Date, treatmentDuration: number) {
    try {
      console.log('=== GENERATING TIME SLOTS ===');
      console.log('Barber ID:', barberId);
      console.log('Date:', date.toDateString());
      console.log('Treatment Duration:', treatmentDuration, 'minutes');

      // Get barber's availability for the selected day
      // CRITICAL FIX: Use toYMD to avoid timezone issues (especially after midnight)
      const dateString = toYMD(date);
      const [Y, M, D] = dateString.split('-').map(Number);
      const dayOfWeek = new Date(Y, M - 1, D).getDay();

      // Use real-time availability data if available
      let availableTimeSlots: string[] = [];

      console.log('🔍 generateAvailableSlots - dateString:', dateString);
      console.log('🔍 generateAvailableSlots - dateSpecificAvailability state:', dateSpecificAvailability);
      console.log('🔍 generateAvailableSlots - dateSpecificAvailability[' + dateString + ']:', dateSpecificAvailability[dateString]);

      // PRIORITY 1: Check date-specific availability first
      if (dateString in dateSpecificAvailability) {
        const dateSlots = dateSpecificAvailability[dateString];
        if (dateSlots === null) {
          console.log('🚫 Date explicitly UNAVAILABLE');
          return [];
        } else if (dateSlots && dateSlots.length > 0) {
          console.log('✅ Using DATE-SPECIFIC availability:', dateSlots.length, 'slots');
          availableTimeSlots = dateSlots;
        } else {
          console.log('⚠️ Date has no slots');
          return [];
        }
      } else {
        // FALLBACK: Load from database
        console.log('📅 Loading availability from database (not in real-time state)');
        availableTimeSlots = await getBarberAvailableSlots(barberId, dateString);
        console.log('📅 Database slots loaded:', availableTimeSlots.length, 'slots');
      }

      if (availableTimeSlots.length === 0) {
        console.log('❌ Barber not available on this day - NO SLOTS AVAILABLE');
        return [];
      }

      console.log('📅 Available time slots:', availableTimeSlots);

      const appointments = await getBarberAppointmentsForDay(barberId, date);
      console.log('Found', appointments.length, 'appointments for this day');

      const slots = [];

      // IMPORTANT: Show slots at intervals matching the treatment duration!
      // For 30-min treatment: 9:00, 9:30, 10:00...
      // For 20-min treatment: 9:00, 9:20, 9:40...
      // For 15-min treatment: 9:00, 9:15, 9:30...

      // First, filter slots that can fit the treatment before midnight
      const validSlots = availableTimeSlots.filter(slot => {
        const startMinutes = toMin(slot);
        const endMinutes = startMinutes + treatmentDuration;
        return endMinutes <= 24 * 60;
      });

      if (validSlots.length === 0) {
        console.log('❌ No valid slots for this treatment duration');
        return [];
      }

      // FIXED: Generate slot candidates starting from ACTUAL availability start
      // Steps forward by treatment duration (not 5-min intervals)
      // Example: availability 14:05-15:40, treatment 25min → [14:05, 14:30, 14:55, 15:20]
      const slotCandidates: string[] = [];

      // Find the earliest and latest available times
      const sortedSlots = [...validSlots].sort((a, b) => toMin(a) - toMin(b));
      const earliestMinutes = toMin(sortedSlots[0]);
      const latestMinutes = toMin(sortedSlots[sortedSlots.length - 1]);

      // Align start to grid (grid starts at 7:15 = 435 minutes)
      // Grid pattern: 7:15, 7:40, 8:05, 8:30, 8:55... 16:25, 16:50...
      const BASE_GRID_START = 7 * 60 + 15; // 7:15 = 435 minutes
      let alignedStart;
      if (earliestMinutes <= BASE_GRID_START) {
        alignedStart = BASE_GRID_START;
      } else {
        // Calculate how many slots have passed since BASE_GRID_START
        const slotsPassed = Math.ceil((earliestMinutes - BASE_GRID_START) / SLOT_SIZE_MINUTES);
        alignedStart = BASE_GRID_START + (slotsPassed * SLOT_SIZE_MINUTES);
      }

      // Generate candidate start times by stepping forward in treatment duration increments
      // A candidate is valid only if (start + duration) fits COMPLETELY within availability
      // CRITICAL: Treatment must END at or before the last available slot
      for (let t = alignedStart; t + treatmentDuration <= latestMinutes + SLOT_SIZE_MINUTES; t += treatmentDuration) {
        const timeString = `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;

        // Check if this start time AND all slots during the treatment are available
        // This ensures the ENTIRE treatment duration has available slots
        let allSlotsAvailable = true;
        for (let checkMinutes = t; checkMinutes < t + treatmentDuration; checkMinutes += SLOT_SIZE_MINUTES) {
          const checkTime = `${Math.floor(checkMinutes / 60).toString().padStart(2, '0')}:${(checkMinutes % 60).toString().padStart(2, '0')}`;
          if (!availableTimeSlots.includes(checkTime)) {
            allSlotsAvailable = false;
            console.log(`❌ Slot ${timeString} rejected: missing ${checkTime} (treatment needs ${treatmentDuration}min)`);
            break;
          }
        }

        if (allSlotsAvailable) {
          slotCandidates.push(timeString);
          console.log(`✅ Slot ${timeString} accepted (ends at ${Math.floor((t + treatmentDuration) / 60)}:${((t + treatmentDuration) % 60).toString().padStart(2, '0')})`);
        }
      }

      console.log(`📊 Slot candidates for ${treatmentDuration}min treatment:`, slotCandidates);

      // Convert time strings to Date objects and check for appointment overlaps
      for (const slotTimeString of slotCandidates) {
        const [hour, minute] = slotTimeString.split(':').map(Number);
        const slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);

        // Skip past times if it's today
        const now = new Date();
        if (date.toDateString() === now.toDateString() && slotStart <= now) {
          continue;
        }

        const displayTime = `${slotStart.getHours().toString().padStart(2, '0')}:${slotStart.getMinutes().toString().padStart(2, '0')}`;

        // Check for appointment overlaps
        if (isSlotAvailable(slotStart, treatmentDuration, appointments)) {
          slots.push(slotStart);
          console.log(`✅ Slot available for ${treatmentDuration}min treatment: ${displayTime}`);
        } else {
          console.log(`❌ Slot blocked by appointment: ${displayTime}`);
        }
      }

      console.log('Generated', slots.length, 'available time slots');
      console.log('Available times:', slots.map(s => `${s.getHours()}:${s.getMinutes().toString().padStart(2, '0')}`));

      return slots;
    } catch (error) {
      console.error('Error generating available slots:', error);
      return [];
    }
  }


  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();

    // Start from today (i = 0) and go up to 14 days
    for (let i = 0; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Check if this SPECIFIC DATE is available
      // CRITICAL FIX: Use toYMD to avoid timezone issues (especially after midnight)
      const dateStr = toYMD(date);
      const [Y, M, D] = dateStr.split('-').map(Number);
      const dayOfWeek = new Date(Y, M - 1, D).getDay();

      // CRITICAL: Check date-specific availability ONLY (no weekly fallback!)
      let isAvailable = false;
      if (selectedBarber) {
        if (dateStr in dateSpecificAvailability) {
          const dateSlots = dateSpecificAvailability[dateStr];
          // Available only if there are actual slots (not null or empty)
          isAvailable = dateSlots !== null && Array.isArray(dateSlots) && dateSlots.length > 0;
          console.log(`📅 ${dateStr}: ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'} (${dateSlots === null ? 'explicitly disabled' : dateSlots?.length || 0} slots)`);
        } else {
          // No data for this date - not available
          isAvailable = false;
          console.log(`📅 ${dateStr}: No dailyAvailability found - UNAVAILABLE`);
        }
      } else {
        isAvailable = true; // No barber selected yet
      }

      dates.push({
        date,
        isAvailable,
        dayOfWeek
      });
    }

    return dates;
  };

  const handleBarberSelect = async (barber: Barber) => {
    // Reset date-specific availability when changing barber
    // Each barber has their own availability!
    setDateSpecificAvailability({});
    setAvailableTimes([]);
    setSelectedDate(null);
    setSelectedTime(null);

    setSelectedBarber(barber);
    setCurrentStep(2);

    console.log('🔄 Barber changed, reset availability for new barber:', barber.name);
    // No auto-creation. Customer reflects admin exactly.
  };

  const handleTreatmentSelect = (treatment: Treatment) => {
    setSelectedTreatment(treatment);
    setCurrentStep(3);
    // If we already have a selected date, generate times now
    if (selectedDate && selectedBarber) {
      generateAvailableSlots(selectedBarber.id, selectedDate, treatment.duration).then(slots => {
        const timeStrings = slots.map(slot => formatTimeSlot(slot));
        setAvailableTimes(timeStrings);
      });
    }
  };

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    setCurrentStep(4);
    // CRITICAL FIX: Use toYMD to avoid timezone issues (especially after midnight)
    const dateStr = toYMD(date);
    const [Y, M, D] = dateStr.split('-').map(Number);
    const selectedDayOfWeek = new Date(Y, M - 1, D).getDay();
    console.log('🎯 DATE SELECTED: ' + dateStr + ' dayOfWeek=' + selectedDayOfWeek);
    console.log('🎯 DATE SELECTED: weeklyAvailability for this day:', weeklyAvailability[selectedDayOfWeek] || []);
    if (selectedBarber && selectedTreatment) {
      try {
        const slots = await generateAvailableSlots(selectedBarber.id, date, selectedTreatment.duration);
        const timeStrings = slots.map(slot => formatTimeSlot(slot));
        console.log('🎯 DATE SELECTED: Final timeStrings generated:', timeStrings);

        // If no slots available, check if barber has availability for this day
        if (timeStrings.length === 0) {
          console.log('No slots available, checking barber availability');
          const dayOfWeek = date.getDay();
          const hasAvailability = weeklyAvailability[dayOfWeek] && weeklyAvailability[dayOfWeek].length > 0;

          if (!hasAvailability) {
            console.log('Barber not available on this day - no fallback times');
            setAvailableTimes([]);
          } else {
            console.log('Barber has availability but no slots generated - this might be a bug');
            setAvailableTimes([]);
          }
        } else {
          setAvailableTimes(timeStrings);
        }
      } catch (error) {
        console.error('Error generating slots:', error);
        // Don't use fallback times - respect admin's availability settings
        const dayOfWeek = date.getDay();
        const hasAvailability = weeklyAvailability[dayOfWeek] && weeklyAvailability[dayOfWeek].length > 0;

        if (!hasAvailability) {
          console.log('Barber not available on this day - no fallback times');
          setAvailableTimes([]);
        } else {
          console.log('Error generating slots but barber should be available - showing empty times');
          setAvailableTimes([]);
        }
      }
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setShowConfirmModal(true);
  };

  const handleWaitlistSubmit = async () => {
    const user = getCurrentUser();
    if (!user) {
      Alert.alert('נדרש כניסה', 'יש להתחבר כדי להירשם לרשימת המתנה');
      setShowWaitlistModal(false);
      onNavigate('profile');
      return;
    }

    if (!selectedBarber || !selectedDate) {
      Alert.alert('שגיאה', 'נא לבחור ספר ותאריך');
      return;
    }

    try {
      // Get user profile for display name and phone
      const userProfile = await getUserProfile(user.uid);

      const dateStr = toYMD(selectedDate);

      await createWaitlistEntry({
        userId: user.uid,
        barberId: selectedBarber.id,
        date: dateStr,
        preferredTimeStart: waitlistTimeStart,
        preferredTimeEnd: waitlistTimeEnd,
        userDisplayName: userProfile?.displayName || user.displayName || 'אורח',
        userPhone: userProfile?.phone || '',
      });

      setShowWaitlistModal(false);
      Alert.alert(
        'נרשמת בהצלחה! ✅',
        `נרשמת לרשימת המתנה ליום ${selectedDate.toLocaleDateString('he-IL')} בין השעות ${waitlistTimeStart}-${waitlistTimeEnd}. נודיע לך ברגע שיתפנה תור!`,
        [{ text: 'אישור', style: 'default' }]
      );
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      Alert.alert('שגיאה', 'לא ניתן להירשם לרשימת המתנה כרגע');
    }
  };

  const handleConfirmBooking = async () => {
    const user = getCurrentUser();
    if (!user) {
      Alert.alert(t('common.error'), t('booking.login_required'));
      onNavigate('profile');
      return;
    }

    if (!selectedBarber || !selectedTreatment || !selectedDate || !selectedTime) {
      Alert.alert(t('common.error'), t('booking.select_all_details'));
      return;
    }

    setBooking(true);
    try {
      // Validate selectedTime format
      if (!selectedTime || !selectedTime.match(/^\d{2}:\d{2}$/)) {
        throw new Error('פורמט השעה לא תקין. אנא בחר שעה שוב.');
      }

      const appointmentDateTime = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':').map(Number);

      // Validate hours and minutes
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error('שעה לא תקינה. אנא בחר שעה שוב.');
      }

      appointmentDateTime.setHours(hours, minutes, 0, 0);

      // Validate that the date is valid before proceeding
      if (isNaN(appointmentDateTime.getTime())) {
        throw new Error('תאריך לא תקין. אנא נסה שנית.');
      }

      console.log('Creating appointment:', {
        barberId: selectedBarber.id,
        date: appointmentDateTime.toISOString(),
        duration: selectedTreatment.duration
      });

      // Double-check availability before creating appointment
      const existingAppointments = await getBarberAppointmentsForDay(selectedBarber.id, selectedDate);
      const isStillAvailable = isSlotAvailable(appointmentDateTime, selectedTreatment.duration, existingAppointments);

      if (!isStillAvailable) {
        Alert.alert(
          t('booking.slot_taken'),
          t('booking.slot_taken_message'),
          [{ text: t('common.confirm'), style: 'default' }]
        );
        setBooking(false);
        setShowConfirmModal(false);
        // Refresh available times
        if (selectedBarber && selectedTreatment) {
          const slots = await generateAvailableSlots(selectedBarber.id, selectedDate, selectedTreatment.duration);
          const timeStrings = slots.map(slot => formatTimeSlot(slot));
          setAvailableTimes(timeStrings);
        }
        return;
      }

      console.log('📅 Creating appointment with userId:', user.uid);

      await createAppointment({
        userId: user.uid,
        barberId: selectedBarber.id,
        treatmentId: selectedTreatment.id,
        date: Timestamp.fromDate(appointmentDateTime),
        duration: selectedTreatment.duration, // Save duration!
        status: 'confirmed' // Changed from 'pending' to 'confirmed' - auto-approve appointments
      });

      console.log('Appointment created successfully');
      setShowConfirmModal(false);
      setSuccessMessage(t('booking.appointment_details', {
        date: selectedDate.toLocaleDateString('he-IL'),
        time: selectedTime
      }));
      setShowSuccessModal(true);

      // אחרי יצירת התור בהצלחה - השתמש באותו תאריך שיצרנו למעלה
      // לא צריך ליצור תאריך חדש, רק לוודא שהתאריך נכון
      // התזכורות יטופלו על ידי המערכת המרכזית ב-firebase.ts
      // לא צריך לקרוא ל-scheduleAppointmentReminders כאן כי זה יוצר כפילות

    } catch (error: any) {
      console.error('Error creating appointment:', error);
      // Show the actual error message from Firebase (e.g., "אופס! מישהו תפס את השעה לפני שהספקת!")
      const errorMessage = error?.message || t('booking.booking_error');
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setBooking(false);
    }
  };

  const resetBooking = () => {
    setCurrentStep(preSelectedBarberId ? 2 : 1);
    if (!preSelectedBarberId) {
      setSelectedBarber(null);
    }
    setSelectedTreatment(null);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);

      switch (currentStep) {
        case 2:
          if (!preSelectedBarberId) {
            setSelectedBarber(null);
          }
          break;
        case 3:
          setSelectedTreatment(null);
          break;
        case 4:
          setSelectedDate(null);
          break;
      }
    }
  };

  const formatDate = (date: Date) => {
    const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];

    return `יום ${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'בחר ספר';
      case 2: return 'בחר טיפול';
      case 3: return 'בחר תאריך';
      case 4: return 'בחר שעה';
      default: return 'הזמנת תור';
    }
  };

  // Animation state for fade-in
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Fade in animation when step changes
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  // פונקציה לתזמון התראות פוש ללקוח שעה ורבע שעה לפני התור
  const scheduleAppointmentReminders = async (appointmentDate: Date, treatmentName: string) => {
    const now = new Date();

    // Check if appointment is in the future
    const timeUntilAppointment = appointmentDate.getTime() - now.getTime();
    const hoursUntilAppointment = timeUntilAppointment / (1000 * 60 * 60);

    console.log('📅 Appointment date:', appointmentDate.toLocaleString());
    console.log('⏰ Current time:', now.toLocaleString());
    console.log('⏱️ Hours until appointment:', hoursUntilAppointment);

    // Only schedule reminders if appointment is in the future
    if (hoursUntilAppointment <= 0) {
      console.log('❌ Appointment is in the past, skipping reminders');
      return;
    }

    // Don't schedule local notifications for appointments more than 24 hours away
    // The cloud scheduler will handle those via scheduledReminders collection
    if (hoursUntilAppointment > 24) {
      console.log('✅ Appointment is more than 24 hours away - cloud scheduler will handle reminders');
      return;
    }

    // Calculate notification times
    const hourBefore = new Date(appointmentDate.getTime() - 60 * 60 * 1000);
    const quarterBefore = new Date(appointmentDate.getTime() - 15 * 60 * 1000);

    const secondsUntilHour = Math.floor((hourBefore.getTime() - now.getTime()) / 1000);
    const secondsUntilQuarter = Math.floor((quarterBefore.getTime() - now.getTime()) / 1000);

    console.log('⏰ Seconds until hour reminder:', secondsUntilHour);
    console.log('⏰ Seconds until quarter reminder:', secondsUntilQuarter);

    // Schedule hour reminder only if it's in the future and appointment is at least 1 hour away
    if (secondsUntilHour > 0 && hoursUntilAppointment >= 1) {
      console.log('✅ Scheduling hour reminder for', new Date(now.getTime() + secondsUntilHour * 1000).toLocaleString());
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'תזכורת לתור! 💈',
          body: `יש לך תור ל-${treatmentName} בעוד שעה!`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: { seconds: secondsUntilHour, repeats: false, channelId: 'default' },
      });
    } else {
      console.log('❌ Hour reminder not scheduled - too soon or in past');
    }

    // Schedule quarter reminder only if it's in the future and appointment is at least 15 minutes away
    if (secondsUntilQuarter > 0 && hoursUntilAppointment >= 0.25) {
      console.log('✅ Scheduling quarter reminder for', new Date(now.getTime() + secondsUntilQuarter * 1000).toLocaleString());
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'תזכורת לתור! 💈',
          body: `יש לך תור ל-${treatmentName} בעוד רבע שעה!`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: { seconds: secondsUntilQuarter, repeats: false, channelId: 'default' },
      });
    } else {
      console.log('❌ Quarter reminder not scheduled - too soon or in past');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav
          title={t('booking.title')}
          onBellPress={() => { }}
          onMenuPress={() => { }}
          showBackButton={true}
          onBackPress={onBack}
          showCloseButton={true}
          onClosePress={onClose}
        />
        <View style={styles.loadingContainer}>
          <ScissorsLoader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        title={t('booking.title')}
        onBellPress={() => { }}
        onMenuPress={() => { }}
        showBackButton={true}
        onBackPress={onBack}
        showCloseButton={true}
        onClosePress={onClose}
      />

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(currentStep / 4) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{t('booking.step_of', { current: currentStep, total: 4 })}</Text>
      </View>

      {/* Step Header */}
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>{getStepTitle()}</Text>
        {currentStep > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Step 1: Select Barber */}
        {currentStep === 1 && (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            {/* Background gradient for glass effect */}
            <LinearGradient
              colors={['rgba(139,69,19,0.05)', 'rgba(255,255,255,0.02)', 'rgba(139,69,19,0.03)']}
              style={styles.backgroundGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {barbers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>✂️</Text>
                <Text style={styles.emptyStateTitle}>אין ספרים זמינים</Text>
                <Text style={styles.emptyStateText}>
                  אנא פנה למנהל המערכת להוספת ספרים למערכת
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={onBack}
                >
                  <Text style={styles.emptyStateButtonText}>חזור</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.barbersList}>
                {barbers.map((barber) => (
                  <TouchableOpacity
                    key={barber.id}
                    style={[
                      styles.barberCard,
                      selectedBarber?.id === barber.id && styles.selectedCard
                    ]}
                    onPress={() => handleBarberSelect(barber)}
                    disabled={false}
                  >
                    <LinearGradient
                      colors={selectedBarber?.id === barber.id 
                        ? ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.85)']
                        : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.8)']
                      }
                      style={styles.barberGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {/* Glass effect overlay */}
                      <View style={styles.glassOverlay} />
                      
                      {/* Glossy highlight */}
                      <LinearGradient
                        colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.1)', 'transparent']}
                        style={styles.glossyHighlight}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                      />
                      
                      <View style={styles.barberImage}>
                        {barber.image ? (
                          <OptimizedImage
                            source={{ uri: barber.image }}
                            style={styles.barberPhoto}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.barberPlaceholder}>✂️</Text>
                        )}
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.bookButton} 
                        onPress={() => handleBarberSelect(barber)}
                      >
                        <LinearGradient
                          colors={['#8B4513', '#A0522D', '#8B4513']}
                          style={styles.bookButtonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.bookButtonText}>הזמנת תור</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      
                      <View style={styles.barberInfoContainer}>
                        <Text style={styles.barberName}>{barber.name}</Text>
                        <Text style={styles.barberExperience}>{barber.experience}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* Step 2: Select Treatment */}
        {currentStep === 2 && (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            <View style={styles.treatmentsContainer}>
              {treatments.map((treatment) => (
                <TouchableOpacity
                  key={treatment.id}
                  style={[
                    styles.treatmentCard,
                    selectedTreatment?.id === treatment.id && styles.selectedCard
                  ]}
                  onPress={() => handleTreatmentSelect(treatment)}
                >
                  <LinearGradient
                    colors={['#1a1a1a', '#000000', '#1a1a1a']}
                    style={styles.treatmentGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.treatmentImage}>
                      <Text style={styles.treatmentPlaceholder}>💇</Text>
                    </View>
                    <View style={styles.treatmentInfo}>
                      <Text style={styles.treatmentName}>{treatment.name}</Text>
                      <Text style={styles.treatmentDescription}>{treatment.description}</Text>
                      <View style={styles.treatmentDetails}>
                        <Text style={styles.treatmentPrice}>{t('booking.price', { price: treatment.price })}</Text>
                        <Text style={styles.treatmentDuration}>{t('booking.duration', { duration: treatment.duration })}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Step 3: Select Date */}
        {currentStep === 3 && (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            {/* Refresh Button */}
            <View style={styles.refreshContainer}>
              <TouchableOpacity
                style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
                onPress={refreshAvailability}
                disabled={refreshing || !selectedBarber}
              >
                <Text style={styles.refreshButtonText}>
                  {refreshing ? 'מעדכן...' : '🔄 רענן זמינות'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.datesContainer}>
              {availableDates.length > 0 ? availableDates.map((dateObj, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dateCard,
                    selectedDate?.getTime() === dateObj.date.getTime() && styles.selectedCard,
                    !dateObj.isAvailable && styles.unavailableCard
                  ]}
                  onPress={() => dateObj.isAvailable ? handleDateSelect(dateObj.date) : null}
                  disabled={!dateObj.isAvailable}
                >
                  <LinearGradient
                    colors={dateObj.isAvailable ? ['#1a1a1a', '#000000', '#1a1a1a'] : ['#ff4444', '#cc0000', '#ff4444']}
                    style={styles.dateGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={[styles.dateText, !dateObj.isAvailable && styles.unavailableText]}>
                      {formatDate(dateObj.date)}
                    </Text>
                    <Text style={[styles.dateNumber, !dateObj.isAvailable && styles.unavailableText]}>
                      {dateObj.date.getDate()}
                    </Text>
                    {!dateObj.isAvailable && (
                      <Text style={styles.unavailableLabel}>לא זמין</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )) : generateAvailableDates().map((dateObj, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dateCard,
                    selectedDate?.getTime() === dateObj.date.getTime() && styles.selectedCard,
                    !dateObj.isAvailable && styles.unavailableCard
                  ]}
                  onPress={() => dateObj.isAvailable ? handleDateSelect(dateObj.date) : null}
                  disabled={!dateObj.isAvailable}
                >
                  <LinearGradient
                    colors={dateObj.isAvailable ? ['#1a1a1a', '#000000', '#1a1a1a'] : ['#ff4444', '#cc0000', '#ff4444']}
                    style={styles.dateGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={[styles.dateText, !dateObj.isAvailable && styles.unavailableText]}>
                      {formatDate(dateObj.date)}
                    </Text>
                    <Text style={[styles.dateNumber, !dateObj.isAvailable && styles.unavailableText]}>
                      {dateObj.date.getDate()}
                    </Text>
                    {!dateObj.isAvailable && (
                      <Text style={styles.unavailableLabel}>לא זמין</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Step 4: Select Time */}
        {currentStep === 4 && (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            {/* Refresh Button */}
            <View style={styles.refreshContainer}>
              <TouchableOpacity
                style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
                onPress={refreshAvailability}
                disabled={refreshing || !selectedBarber}
              >
                <Text style={styles.refreshButtonText}>
                  {refreshing ? 'מעדכן...' : '🔄 רענן זמינות'}
                </Text>
              </TouchableOpacity>
            </View>

            {availableTimes.length === 0 ? (
              <View style={styles.noSlotsContainer}>
                <Text style={styles.noSlotsEmoji}>😔</Text>
                <Text style={styles.noSlotsTitle}>נתפסו כל התורים!</Text>
                <Text style={styles.noSlotsSubtitle}>אין שעות פנויות ביום זה</Text>
                <Text style={styles.noSlotsHint}>נסה לבחור תאריך אחר</Text>
              </View>
            ) : (
              <View style={styles.timesContainer}>
                {availableTimes.map((time, index) => {
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.timeCard,
                        selectedTime === time && styles.selectedCard
                      ]}
                      onPress={() => handleTimeSelect(time)}
                    >
                      <LinearGradient
                        colors={['#1a1a1a', '#000000', '#1a1a1a']}
                        style={styles.timeGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.timeText}>{time}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Waitlist Box */}
            {selectedDate && (
              <TouchableOpacity
                style={styles.waitlistBox}
                onPress={() => setShowWaitlistModal(true)}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#EE5A6F', '#FF6B6B']}
                  style={styles.waitlistGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.waitlistBoxTitle}>לא מצאת תור לזמן שלך? 🕐</Text>
                  <Text style={styles.waitlistBoxSubtitle}>כנס לרשימת המתנה</Text>
                  <Text style={styles.waitlistBoxHint}>נודיע לך ברגע שיתפנה תור!</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Selected Summary */}
        {currentStep > 1 && (
          <View style={styles.summaryContainer}>
            <LinearGradient
              colors={['#1a1a1a', '#000000', '#1a1a1a']}
              style={styles.summaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.summaryTitle}>{t('booking.booking_summary')}</Text>

              {selectedBarber && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('booking.barber')}</Text>
                  <Text style={styles.summaryValue}>{selectedBarber.name}</Text>
                </View>
              )}

              {selectedTreatment && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('booking.treatment')}</Text>
                  <Text style={styles.summaryValue}>{selectedTreatment.name}</Text>
                </View>
              )}

              {selectedDate && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('booking.date')}</Text>
                  <Text style={styles.summaryValue}>{formatDate(selectedDate)}</Text>
                </View>
              )}

              {selectedTime && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('booking.time')}</Text>
                  <Text style={styles.summaryValue}>{selectedTime}</Text>
                </View>
              )}
            </LinearGradient>
          </View>
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showConfirmModal}
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('booking.confirm_booking')}</Text>

            <View style={styles.confirmationDetails}>
              <Text style={styles.confirmationText}>
                {t('booking.barber')} {selectedBarber?.name}
              </Text>
              <Text style={styles.confirmationText}>
                {t('booking.treatment')} {selectedTreatment?.name}
              </Text>
              <Text style={styles.confirmationText}>
                {t('booking.date')} {selectedDate && formatDate(selectedDate)}
              </Text>
              <Text style={styles.confirmationText}>
                {t('booking.time')} {selectedTime && selectedTreatment && (() => {
                  const [hours, minutes] = selectedTime.split(':').map(Number);
                  const startMinutes = hours * 60 + minutes;
                  const endMinutes = startMinutes + selectedTreatment.duration;
                  const endHours = Math.floor(endMinutes / 60);
                  const endMins = endMinutes % 60;
                  const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
                  return `${selectedTime} - ${endTime}`;
                })()}
              </Text>
              <Text style={styles.confirmationPrice}>
                {t('booking.price', { price: selectedTreatment?.price })}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmBooking}
                disabled={booking}
              >
                <Text style={styles.confirmButtonText}>
                  {booking ? t('common.loading') : t('booking.confirm_booking')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowConfirmModal(false)}
                disabled={booking}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          resetBooking();
          onNavigate('profile');
        }}
        title={t('booking.appointment_booked')}
        message={successMessage}
        type="success"
        icon="checkmark-circle"
        confirmText={t('profile.view_all')}
        onConfirm={() => {
          setShowSuccessModal(false);
          resetBooking();
          onNavigate('profile');
        }}
      />

      {/* Waitlist Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showWaitlistModal}
        onRequestClose={() => setShowWaitlistModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>רשימת המתנה 📋</Text>

            <View style={styles.waitlistModalContent}>
              <Text style={styles.waitlistModalSubtitle}>
                ליום: {selectedDate?.toLocaleDateString('he-IL')}
              </Text>

              <Text style={styles.waitlistLabel}>לאיזה שעה תעדיף?</Text>
              <Text style={styles.waitlistHint}>אנא כתוב טווח שעות רצוי</Text>

              <View style={styles.timeRangeContainer}>
                <View style={styles.timeInputContainer}>
                  <Text style={styles.timeLabel}>משעה:</Text>
                  <ScrollView
                    style={styles.timePicker}
                    showsVerticalScrollIndicator={true}
                  >
                    {generateTimeSlots(8, 20).map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeOption,
                          waitlistTimeStart === time && styles.selectedTimeOption
                        ]}
                        onPress={() => setWaitlistTimeStart(time)}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          waitlistTimeStart === time && styles.selectedTimeOptionText
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.timeInputContainer}>
                  <Text style={styles.timeLabel}>עד שעה:</Text>
                  <ScrollView
                    style={styles.timePicker}
                    showsVerticalScrollIndicator={true}
                  >
                    {generateTimeSlots(8, 20).map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeOption,
                          waitlistTimeEnd === time && styles.selectedTimeOption
                        ]}
                        onPress={() => setWaitlistTimeEnd(time)}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          waitlistTimeEnd === time && styles.selectedTimeOptionText
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <Text style={styles.waitlistSummary}>
                טווח שעות מבוקש: {waitlistTimeStart} - {waitlistTimeEnd}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleWaitlistSubmit}
              >
                <Text style={styles.confirmButtonText}>הירשם לרשימת המתנה</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowWaitlistModal(false)}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  stepHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  stepContent: {
    padding: 16,
    position: 'relative',
    minHeight: 400,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  barbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  barberCard: {
    width: width - 32,
    height: 110,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  barbersList: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  barberGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    borderRadius: 24,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 12,
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  glossyHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderRadius: 24,
    zIndex: 1,
  },
  barberPhoto: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#fff',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#8B4513',
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    transform: [{ scale: 1.02 }],
  },
  barberImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    marginLeft: 'auto',
  },
  barberPlaceholder: {
    fontSize: 30,
    color: '#333',
  },
  barberInfoContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 8,
    marginRight: 8,
  },
  barberName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'right',
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  barberExperience: {
    fontSize: 14,
    color: '#555',
    textAlign: 'right',
    fontWeight: '500',
  },
  unavailableBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  unavailableText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  treatmentsContainer: {
    marginBottom: 16,
  },
  treatmentCard: {
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  },
  treatmentGradient: {
    padding: 20,
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  treatmentImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  treatmentPlaceholder: {
    fontSize: 30,
    color: '#fff',
  },
  treatmentInfo: {
    flex: 1,
  },
  treatmentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'right',
  },
  treatmentDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    textAlign: 'right',
  },
  treatmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  treatmentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  treatmentDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  datesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dateCard: {
    width: (width - 48) / 2,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  },
  unavailableCard: {
    opacity: 0.6,
  },
  dateGradient: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  unavailableLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
  },
  timesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  timeCard: {
    width: (width - 60) / 3,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  },
  timeGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    minHeight: 60,
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  timeBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotLabel: {
    fontSize: 8,
    color: '#999',
    marginBottom: 2,
    fontWeight: '500',
  },
  timeSlotValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  timeSeparator: {
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContainer: {
    margin: 16,
    borderRadius: 24,
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  },
  summaryGradient: {
    padding: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'right',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    width: width * 0.9,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmationDetails: {
    marginBottom: 24,
  },
  confirmationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    textAlign: 'right',
  },
  confirmationPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff',
    marginTop: 8,
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#8B4513',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bookButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 120,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  bookButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  refreshContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noSlotsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  noSlotsEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  noSlotsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  noSlotsSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  noSlotsHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  waitlistBox: {
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  waitlistGradient: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  waitlistBoxTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitlistBoxSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  waitlistBoxHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  waitlistModalContent: {
    marginVertical: 20,
  },
  waitlistModalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  waitlistLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitlistHint: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
    textAlign: 'center',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeInputContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  timePicker: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  timeOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    alignItems: 'center',
  },
  selectedTimeOption: {
    backgroundColor: '#007bff',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedTimeOptionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  waitlistSummary: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    textAlign: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#e7f3ff',
    borderRadius: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  emptyStateButton: {
    backgroundColor: '#8B4513',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BookingScreen; 
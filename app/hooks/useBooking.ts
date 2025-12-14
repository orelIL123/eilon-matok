import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { Barber, collections, db, Treatment } from '../config/firebase';

export interface BookingData {
  barberId: string;
  barberName: string;
  treatmentId: string;
  treatmentName: string;
  treatmentPrice: number;
  treatmentDuration: number;
  date: string;
  time: string;
  clientId: string;
  clientName: string;
  status: 'scheduled' | 'cancelled' | 'completed';
}

export const useBooking = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<Partial<BookingData>>({});

  const updateBookingData = useCallback((data: Partial<BookingData>) => {
    setBookingData(prev => ({ ...prev, ...data }));
  }, []);

  const createBooking = useCallback(async (finalData: BookingData) => {
    setLoading(true);
    setError(null);
    
    try {
      // Create appointment document
      const appointmentData = {
        clientId: finalData.clientId,
        barberId: finalData.barberId,
        treatmentId: finalData.treatmentId,
        date: finalData.date,
        time: finalData.time,
        status: 'scheduled' as const,
        createdAt: serverTimestamp(),
      };

      const appointmentRef = await addDoc(collection(db, collections.appointments), appointmentData);
      
      return appointmentRef.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת התור');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getBarberDetails = useCallback(async (barberId: string): Promise<Barber | null> => {
    try {
      const barberDoc = await getDoc(doc(db, collections.barbers, barberId));
      if (barberDoc.exists()) {
        return { ...barberDoc.data(), barberId: barberDoc.id } as Barber;
      }
      return null;
    } catch (error) {
      console.error('Error fetching barber details:', error);
      return null;
    }
  }, []);

  const getTreatmentDetails = useCallback(async (treatmentId: string): Promise<Treatment | null> => {
    try {
      const treatmentDoc = await getDoc(doc(db, collections.treatments, treatmentId));
      if (treatmentDoc.exists()) {
        return { ...treatmentDoc.data(), treatmentId: treatmentDoc.id } as Treatment;
      }
      return null;
    } catch (error) {
      console.error('Error fetching treatment details:', error);
      return null;
    }
  }, []);

  const resetBooking = useCallback(() => {
    setBookingData({});
    setError(null);
  }, []);

  return {
    bookingData,
    loading,
    error,
    updateBookingData,
    createBooking,
    getBarberDetails,
    getTreatmentDetails,
    resetBooking,
  };
}; 
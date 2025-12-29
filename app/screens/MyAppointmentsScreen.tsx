import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {
    Appointment,
    Barber,
    cancelAppointment,
    deleteAppointment,
    getBarbers,
    getCurrentUser,
    getTreatments,
    getUserAppointments,
    Treatment
} from '../../services/firebase';
import ScissorsLoader from '../components/ScissorsLoader';
import ToastMessage from '../components/ToastMessage';
import TopNav from '../components/TopNav';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

interface MyAppointmentsScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

type FilterType = 'upcoming' | 'past';

const MyAppointmentsScreen: React.FC<MyAppointmentsScreenProps> = ({ onNavigate, onBack }) => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const user = getCurrentUser();

      console.log('🔍 MyAppointments - Current user:', user?.uid);

      if (!user) {
        console.warn('❌ MyAppointments - No user logged in, redirecting to profile');
        Alert.alert(t('common.error'), 'נא להתחבר כדי לראות תורים');
        onNavigate('profile');
        return;
      }

      console.log('📡 MyAppointments - Fetching data for user:', user.uid);

      const [appointmentsData, barbersData, treatmentsData] = await Promise.all([
        getUserAppointments(user.uid),
        getBarbers(),
        getTreatments()
      ]);

      console.log('📅 MyAppointments - Loaded appointments:', appointmentsData.length);
      console.log('📅 MyAppointments - User ID:', user.uid);
      console.log('📅 MyAppointments - Appointment details:', appointmentsData.map(apt => ({
        id: apt.id,
        date: apt.date.toDate ? apt.date.toDate().toISOString() : apt.date,
        status: apt.status,
        barberId: apt.barberId,
        treatmentId: apt.treatmentId,
        userId: apt.userId // Show userId to verify it matches
      })));

      // Check if any appointments are past
      const now = new Date();
      const upcomingCount = appointmentsData.filter(apt => {
        const aptDate = apt.date.toDate ? apt.date.toDate() : new Date(apt.date);
        return aptDate >= now && apt.status !== 'completed' && apt.status !== 'cancelled';
      }).length;

      console.log('📊 MyAppointments - Upcoming appointments:', upcomingCount);
      console.log('📊 MyAppointments - Total appointments:', appointmentsData.length);

      setAppointments(appointmentsData);
      setBarbers(barbersData);
      setTreatments(treatmentsData);
    } catch (error) {
      console.error('Error loading appointments:', error);
      showToast('שגיאה בטעינת התורים', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ ...toast, visible: false });
  };

  const getBarberName = (barberId: string) => {
    const barber = barbers.find(b => b.id === barberId);
    return barber ? barber.name : 'לא נמצא';
  };

  const getTreatmentName = (treatmentId: string) => {
    const treatment = treatments.find(t => t.id === treatmentId);
    return treatment ? treatment.name : 'לא נמצא';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#8B4513';
      case 'pending': return '#FF9800';
      case 'completed': return '#2196F3';
      case 'cancelled': return '#9E9E9E';
      default: return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'מאושר';
      case 'pending': return 'ממתין לאישור';
      case 'completed': return 'הושלם';
      case 'cancelled': return 'בוטל';
      default: return status;
    }
  };

  const isPastAppointment = (appointment: Appointment): boolean => {
    const now = new Date();
    const aptDate = appointment.date.toDate ? appointment.date.toDate() : new Date(appointment.date);
    return aptDate < now || appointment.status === 'completed' || appointment.status === 'cancelled';
  };

  const canCancelAppointment = (appointment: Appointment): boolean => {
    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return false;
    }

    const now = new Date();
    const aptDate = appointment.date.toDate ? appointment.date.toDate() : new Date(appointment.date);
    const hoursUntilAppointment = (aptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    return hoursUntilAppointment > 2; // Allow cancellation only if more than 2 hours before appointment
  };

  const canDeleteAppointment = (appointment: Appointment): boolean => {
    // Only allow deletion of past or cancelled appointments
    return appointment.status === 'completed' || appointment.status === 'cancelled' || isPastAppointment(appointment);
  };

  const handleCancelAppointment = (appointment: Appointment) => {
    if (!canCancelAppointment(appointment)) {
      Alert.alert(
        'לא ניתן לביטול',
        'לא ניתן לבטל תור פחות משעתיים לפני המועד',
        [{ text: 'אישור', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'ביטול תור',
      'האם אתה בטוח שברצונך לבטל את התור?',
      [
        { text: 'לא', style: 'cancel' },
        {
          text: 'כן, בטל',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAppointment(appointment.id);
              await loadData();
              showToast('התור בוטל בהצלחה');
            } catch (error) {
              console.error('Error cancelling appointment:', error);
              showToast('שגיאה בביטול התור', 'error');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAppointment = (appointment: Appointment) => {
    if (!canDeleteAppointment(appointment)) {
      Alert.alert(
        'לא ניתן למחיקה',
        'ניתן למחוק רק תורים שעברו או בוטלו',
        [{ text: 'אישור', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'מחיקת תור',
      'האם אתה בטוח שברצונך למחוק את התור מההיסטוריה?',
      [
        { text: 'לא', style: 'cancel' },
        {
          text: 'כן, מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAppointment(appointment.id);
              await loadData();
              showToast('התור נמחק בהצלחה');
            } catch (error) {
              console.error('Error deleting appointment:', error);
              showToast('שגיאה במחיקת התור', 'error');
            }
          }
        }
      ]
    );
  };

  const filteredAppointments = appointments.filter(apt => {
    if (filter === 'upcoming') {
      return !isPastAppointment(apt);
    } else {
      return isPastAppointment(apt);
    }
  }).sort((a, b) => {
    const aTime = a.date.toMillis ? a.date.toMillis() : a.date.toDate().getTime();
    const bTime = b.date.toMillis ? b.date.toMillis() : b.date.toDate().getTime();
    return filter === 'upcoming' ? aTime - bTime : bTime - aTime;
  });

  const upcomingCount = appointments.filter(apt => !isPastAppointment(apt)).length;
  const pastCount = appointments.filter(apt => isPastAppointment(apt)).length;

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        title="התורים שלי"
        onBellPress={() => {}}
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => onNavigate('profile'))}
      />

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'upcoming' && styles.activeFilterButtonUpcoming
          ]}
          onPress={() => setFilter('upcoming')}
        >
          <LinearGradient
            colors={filter === 'upcoming' ? [colors.barberGold, colors.barberGoldDark] : ['#f8f9fa', '#e9ecef']}
            style={styles.filterGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.filterContent}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={filter === 'upcoming' ? '#fff' : '#666'}
              />
              <Text style={[
                styles.filterText,
                filter === 'upcoming' && styles.activeFilterText
              ]}>
                עתידיים
              </Text>
              <View style={[
                styles.filterBadge,
                filter === 'upcoming' && styles.activeFilterBadge
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  filter === 'upcoming' && styles.activeFilterBadgeText
                ]}>
                  {upcomingCount}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'past' && styles.activeFilterButtonPast
          ]}
          onPress={() => setFilter('past')}
        >
          <LinearGradient
            colors={filter === 'past' ? [colors.barberGold, colors.barberGoldDark] : ['#f8f9fa', '#e9ecef']}
            style={styles.filterGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.filterContent}>
              <Ionicons
                name="time-outline"
                size={20}
                color={filter === 'past' ? '#fff' : '#666'}
              />
              <Text style={[
                styles.filterText,
                filter === 'past' && styles.activeFilterText
              ]}>
                עברו
              </Text>
              <View style={[
                styles.filterBadge,
                filter === 'past' && styles.activeFilterBadge
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  filter === 'past' && styles.activeFilterBadgeText
                ]}>
                  {pastCount}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Appointments List */}
      <ScrollView style={styles.appointmentsList}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ScissorsLoader />
          </View>
        ) : filteredAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={filter === 'upcoming' ? 'calendar-outline' : 'time-outline'}
              size={80}
              color="#ccc"
            />
            <Text style={styles.emptyStateTitle}>
              {filter === 'upcoming' ? 'אין תורים עתידיים' : 'אין תורים שעברו'}
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              {filter === 'upcoming'
                ? 'לא מצאת תור מתאים? קבע תור חדש עכשיו!'
                : 'כאן יופיעו תורים שכבר עברו או בוטלו'}
            </Text>
            {filter === 'upcoming' && (
              <TouchableOpacity
                style={styles.bookNewButton}
                onPress={() => onNavigate('booking')}
              >
                <LinearGradient
                  colors={[colors.barberGold, colors.barberGoldDark]}
                  style={styles.bookNewGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add-circle-outline" size={24} color="#fff" />
                  <Text style={styles.bookNewText}>קבע תור חדש</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredAppointments.map((appointment) => {
            const isPast = isPastAppointment(appointment);
            return (
              <View key={appointment.id} style={styles.appointmentCard}>
                <LinearGradient
                  colors={['#ffffff', '#f8f9fa']}
                  style={styles.cardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(appointment.status) }
                    ]}>
                      <Text style={styles.statusText}>
                        {getStatusText(appointment.status)}
                      </Text>
                    </View>
                    {isPast && (
                      <View style={styles.pastBadge}>
                        <Text style={styles.pastBadgeText}>עבר</Text>
                      </View>
                    )}
                  </View>

                  {/* Treatment Name */}
                  <View style={styles.treatmentContainer}>
                    <Ionicons name="cut-outline" size={24} color="#8B4513" />
                    <Text style={styles.treatmentName}>
                      {getTreatmentName(appointment.treatmentId)}
                    </Text>
                  </View>

                  {/* Appointment Details */}
                  <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={18} color="#666" />
                        <Text style={styles.detailText}>
                          {formatDate(appointment.date)}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="time" size={18} color="#666" />
                        <Text style={styles.detailText}>
                          {formatTime(appointment.date)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="person" size={18} color="#666" />
                        <Text style={styles.detailText}>
                          {getBarberName(appointment.barberId)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionsContainer}>
                    {canCancelAppointment(appointment) && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleCancelAppointment(appointment)}
                      >
                        <Ionicons name="close-circle" size={20} color="#F44336" />
                        <Text style={styles.cancelButtonText}>בטל תור</Text>
                      </TouchableOpacity>
                    )}
                    {canDeleteAppointment(appointment) && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteAppointment(appointment)}
                      >
                        <Ionicons name="trash" size={20} color="#9E9E9E" />
                        <Text style={styles.deleteButtonText}>מחק</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </LinearGradient>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Action Button */}
      {filter === 'upcoming' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => onNavigate('booking')}
        >
          <LinearGradient
            colors={['#8B4513', '#654321']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeFilterButtonUpcoming: {
    shadowColor: '#8B4513',
    shadowOpacity: 0.3,
  },
  activeFilterButtonPast: {
    shadowColor: '#2196F3',
    shadowOpacity: 0.3,
  },
  filterGradient: {
    padding: 12,
  },
  filterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  filterText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  activeFilterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  activeFilterBadgeText: {
    color: '#fff',
  },
  appointmentsList: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  bookNewButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  bookNewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  bookNewText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  appointmentCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardGradient: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pastBadge: {
    backgroundColor: '#9E9E9E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pastBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  treatmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  treatmentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
  },
  detailsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detailText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF5F5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#9E9E9E',
  },
  deleteButtonText: {
    color: '#9E9E9E',
    fontSize: 14,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MyAppointmentsScreen;

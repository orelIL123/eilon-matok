import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    checkIsAdmin,
    cleanupOldWaitlistEntries,
    deleteWaitlistEntry,
    getBarbers,
    getWaitlistEntriesForWeek,
    WaitlistEntry
} from '../../services/firebase';
import ScissorsLoader from '../components/ScissorsLoader';
import TopNav from '../components/TopNav';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

interface AdminWaitlistScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

const AdminWaitlistScreen: React.FC<AdminWaitlistScreenProps> = ({ 
  onNavigate, 
  onBack 
}) => {
  console.log('🚀 AdminWaitlistScreen component mounting...');
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waitlistByDate, setWaitlistByDate] = useState<{[date: string]: WaitlistEntry[]}>({});
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [barbers, setBarbers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  console.log('🚀 AdminWaitlistScreen state initialized');

  useEffect(() => {
    checkAdminStatus();
    loadBarbers();
  }, []);

  useEffect(() => {
    if (selectedBarberId) {
      loadWaitlist();
    }
  }, [selectedBarberId]);

  const checkAdminStatus = async () => {
    try {
      const { getCurrentUser } = await import('../../services/firebase');
      const currentUser = getCurrentUser();
      
      console.log('🔍 Checking admin status for waitlist screen');
      console.log('👤 Current user:', currentUser?.uid);
      
      if (currentUser) {
        const adminStatus = await checkIsAdmin(currentUser.uid);
        console.log('👨‍💼 Admin status:', adminStatus);
        setIsAdmin(adminStatus);
        if (!adminStatus) {
          console.log('❌ User is not admin - redirecting to home');
          Alert.alert('שגיאה', 'אין לך הרשאות מנהל');
          onNavigate('home');
          return;
        }
        console.log('✅ User is admin - proceeding');
      } else {
        console.log('❌ No current user - redirecting to home');
        onNavigate('home');
        return;
      }
    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      onNavigate('home');
    }
  };

  const loadBarbers = async () => {
    try {
      console.log('📋 Loading barbers...');
      const barbersData = await getBarbers();
      console.log('📋 Barbers loaded:', barbersData.length);
      setBarbers(barbersData);
      if (barbersData.length > 0) {
        setSelectedBarberId(barbersData[0].id);
        console.log('✅ Selected first barber:', barbersData[0].id);
      } else {
        console.log('⚠️ No barbers found');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error loading barbers:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת הספרים');
      setLoading(false);
    }
  };

  const loadWaitlist = async (isRefresh = false) => {
    try {
      console.log('📅 Loading waitlist for barber:', selectedBarberId);
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!selectedBarberId) {
        console.log('⚠️ No barber selected - skipping waitlist load');
        setWaitlistByDate({});
        setLoading(false);
        return;
      }

      // Clean up old entries first
      console.log('🧹 Cleaning up old waitlist entries...');
      await cleanupOldWaitlistEntries();

      // Load waitlist for next 7 days
      console.log('📊 Loading waitlist data...');
      const waitlistData = await getWaitlistEntriesForWeek(selectedBarberId);
      console.log('📊 Waitlist data loaded:', Object.keys(waitlistData).length, 'days with entries');
      setWaitlistByDate(waitlistData);
    } catch (error) {
      console.error('❌ Error loading waitlist:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת המתנה');
    } finally {
      console.log('✅ Finished loading waitlist');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert(
      'מחיקת רשומה',
      'האם אתה בטוח שברצונך למחוק רשומה זו מרשימת המתנה?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWaitlistEntry(entryId);
              Alert.alert('הצלחה', 'הרשומה נמחקה בהצלחה');
              loadWaitlist(true);
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('שגיאה', 'לא ניתן למחוק את הרשומה');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${dayName} ${day}/${month}`;
  };

  const get7DaysArray = () => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);
    }

    return dates;
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav 
          title="רשימת המתנה"
          onBellPress={() => onNavigate('admin-notifications')}
          onMenuPress={() => onNavigate('admin-home')}
          showBackButton={true}
          onBackPress={onBack}
        />
        <View style={styles.loadingContainer}>
          <ScissorsLoader />
        </View>
      </SafeAreaView>
    );
  }

  const dates7Days = get7DaysArray();
  const totalEntries = Object.values(waitlistByDate).reduce((sum, entries) => sum + entries.length, 0);

  return (
    <SafeAreaView style={styles.container}>
      <TopNav 
        title="רשימת המתנה"
        onBellPress={() => onNavigate('admin-notifications')}
        onMenuPress={() => onNavigate('admin-home')}
        showBackButton={true}
        onBackPress={onBack}
      />

      {/* Header with stats */}
      <View style={styles.header}>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalEntries}</Text>
            <Text style={styles.statLabel}>סך הכל ברשימה</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{Object.keys(waitlistByDate).length}</Text>
            <Text style={styles.statLabel}>ימים עם רשומות</Text>
          </View>
        </View>

        {/* Barber Selector */}
        {barbers.length > 1 && (
          <View style={styles.barberSelector}>
            <Text style={styles.selectorLabel}>בחר ספר:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barberScroll}>
              {barbers.map((barber) => (
                <TouchableOpacity
                  key={barber.id}
                  style={[
                    styles.barberButton,
                    selectedBarberId === barber.id && styles.barberButtonActive
                  ]}
                  onPress={() => setSelectedBarberId(barber.id)}
                >
                  <Text style={[
                    styles.barberButtonText,
                    selectedBarberId === barber.id && styles.barberButtonTextActive
                  ]}>
                    {barber.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Refresh Button */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadWaitlist(true)}
          disabled={refreshing}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshButtonText}>
            {refreshing ? 'מעדכן...' : 'רענן'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {dates7Days.map((dateStr) => {
          const entries = waitlistByDate[dateStr] || [];
          const hasEntries = entries.length > 0;

          return (
            <View key={dateStr} style={styles.dayCard}>
              <View style={[styles.dayHeader, hasEntries && styles.dayHeaderActive]}>
                <Text style={styles.dayTitle}>{formatDate(dateStr)}</Text>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>{entries.length}</Text>
                </View>
              </View>

              {hasEntries ? (
                <View style={styles.entriesContainer}>
                  {entries.map((entry) => (
                    <View key={entry.id} style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <View style={styles.entryInfo}>
                          <Text style={styles.entryName}>{entry.userDisplayName || 'לא צוין'}</Text>
                          {entry.userPhone && (
                            <Text style={styles.entryPhone}>📞 {entry.userPhone}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteEntry(entry.id)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.entryTime}>
                        <Ionicons name="time-outline" size={16} color="#666" />
                        <Text style={styles.entryTimeText}>
                          {entry.preferredTimeStart} - {entry.preferredTimeEnd}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>אין רשומות ליום זה</Text>
                </View>
              )}
            </View>
          );
        })}

        {totalEntries === 0 && (
          <View style={styles.noDataContainer}>
            <Ionicons name="calendar-outline" size={80} color="#ccc" />
            <Text style={styles.noDataTitle}>אין רשומות ברשימת המתנה</Text>
            <Text style={styles.noDataText}>
              כשלקוחות יירשמו לרשימת המתנה, הם יופיעו כאן
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  barberSelector: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  barberScroll: {
    flexDirection: 'row',
  },
  barberButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  barberButtonActive: {
    backgroundColor: colors.primary,
  },
  barberButtonText: {
    fontSize: 14,
    color: '#666',
  },
  barberButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  dayCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  dayHeaderActive: {
    backgroundColor: '#e7f3ff',
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dayBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 30,
    alignItems: 'center',
  },
  dayBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  entriesContainer: {
    padding: 12,
  },
  entryCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  entryPhone: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
  },
  entryTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryTimeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
});

export default AdminWaitlistScreen;


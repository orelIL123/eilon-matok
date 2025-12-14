import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    getAllAppointments,
    getBarbers,
    getRecentAppointments,
    getTreatments,
    onAuthStateChange,
    updateAppointment
} from '../../services/firebase';
import ScissorsLoader from '../components/ScissorsLoader';
import TopNav from '../components/TopNav';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

interface AdminStatisticsScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

interface StatisticsData {
  totalRevenue: number;
  totalCustomers: number;
  totalUsers: number;
  totalAppointments: number;
  completedAppointments: number;
  pendingAppointments: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  monthlyStats: Array<{ month: string; revenue: number; appointments: number }>;
}

const AdminStatisticsScreen: React.FC<AdminStatisticsScreenProps> = ({ onNavigate, onBack }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatisticsData>({
    totalRevenue: 0,
    totalCustomers: 0,
    totalUsers: 0,
    totalAppointments: 0,
    completedAppointments: 0,
    pendingAppointments: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    monthlyStats: []
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        const adminStatus = await checkIsAdmin(user.uid);
        setIsAdmin(adminStatus);
        if (!adminStatus) {
          onNavigate('home');
        }
      } else {
        onNavigate('home');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadStatistics();
      
      // Set up automatic appointment completion check
      const interval = setInterval(() => {
        checkAndCompleteAppointments();
      }, 60000); // Check every minute
      
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const checkAndCompleteAppointments = async () => {
    try {
      // Only check appointments from last 2 days for auto-completion (much faster)
      const appointments = await getRecentAppointments(2);
      const now = new Date();
      let completedCount = 0;
      
      for (const appointment of appointments) {
        // Only process scheduled appointments
        if ((appointment.status as any) !== 'scheduled') continue;
        
        let appointmentDate: Date;
        try {
          const dateValue = appointment.date as any;
          if (dateValue && typeof dateValue.toDate === 'function') {
            appointmentDate = dateValue.toDate();
          } else if (dateValue) {
            appointmentDate = new Date(dateValue);
          } else {
            continue;
          }
        } catch (error) {
          console.warn('Error parsing appointment date for auto-completion:', error);
          continue;
        }
        
        // Check if appointment time has passed (add 25 minutes buffer for treatment duration)
        const appointmentEndTime = new Date(appointmentDate.getTime() + 25 * 60000);
        
        if (now > appointmentEndTime) {
          console.log(`🕐 Auto-completing appointment: ${appointment.id} at ${appointmentDate.toLocaleString()}`);
          
          // Update appointment status to completed
          await updateAppointment(appointment.id, { status: 'completed' as any });
          completedCount++;
        }
      }
      
      // If any appointments were completed, reload statistics
      if (completedCount > 0) {
        console.log(`✅ Auto-completed ${completedCount} appointments`);
        setTimeout(() => {
          loadStatistics();
        }, 1000);
      }
    } catch (error) {
      console.error('Error in automatic appointment completion:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);
      
      // Load all data for comprehensive statistics
      const [appointments, barbers, treatments] = await Promise.all([
        getAllAppointments(), // Load all appointments for complete stats
        getBarbers(), // Uses cache
        getTreatments() // Uses cache
      ]);

      // Calculate statistics
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let totalRevenue = 0;
      let monthlyRevenue = 0;
      let weeklyRevenue = 0;
      let completedAppointments = 0;
      let pendingAppointments = 0;
      const monthlyStats: { [key: string]: { revenue: number; appointments: number } } = {};
      const uniqueUsers = new Set<string>();

      // Process appointments
      appointments.forEach(appointment => {
        let appointmentDate: Date;
        
        try {
          // Handle different date formats safely
          const dateValue = appointment.date as any;
          
          if (dateValue && typeof dateValue.toDate === 'function') {
            // Firestore Timestamp
            appointmentDate = dateValue.toDate();
          } else if (dateValue && typeof dateValue === 'string') {
            // Date is stored as string
            appointmentDate = new Date(dateValue);
          } else if (dateValue) {
            // Regular date object
            appointmentDate = new Date(dateValue);
          } else {
            // Skip appointments without date
            return;
          }
        } catch (error) {
          console.warn('Error parsing appointment date:', error);
          return; // Skip this appointment
        }
        
        // Track unique users
        if (appointment.userId) {
          uniqueUsers.add(appointment.userId);
        }
        
        const treatment = treatments.find(t => t.id === appointment.treatmentId);
        
        if (treatment) {
          const revenue = treatment.price;
          
          if (appointment.status === 'completed') {
            totalRevenue += revenue;
            completedAppointments++;
            
            // Monthly revenue
            if (appointmentDate >= thisMonth) {
              monthlyRevenue += revenue;
            }
            
            // Weekly revenue
            if (appointmentDate >= thisWeek) {
              weeklyRevenue += revenue;
            }
            
            // Monthly statistics
            const monthKey = `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyStats[monthKey]) {
              monthlyStats[monthKey] = { revenue: 0, appointments: 0 };
            }
            monthlyStats[monthKey].revenue += revenue;
            monthlyStats[monthKey].appointments++;
          } else if ((appointment.status as any) === 'scheduled' || (appointment.status as any) === 'confirmed') {
            pendingAppointments++;
          }
        }
      });

      // Convert monthly stats to array and sort
      const monthlyStatsArray = Object.entries(monthlyStats)
        .map(([month, data]) => ({ 
          month: month.replace('-', '/'), 
          revenue: data.revenue, 
          appointments: data.appointments 
        }))
        .sort((a, b) => b.month.localeCompare(a.month));

      setStats({
        totalRevenue,
        totalCustomers: completedAppointments,
        totalUsers: uniqueUsers.size,
        totalAppointments: appointments.length,
        completedAppointments,
        pendingAppointments,
        monthlyRevenue,
        weeklyRevenue,
        monthlyStats: monthlyStatsArray
      });

    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₪${amount.toLocaleString()}`;
  };

  const clearAllData = () => {
    Alert.alert(
      'ניקוי נתונים ישנים',
      'האם אתה בטוח שברצונך למחוק תורים ישנים (שהושלמו או בוטלו מלפני 30 יום)?\n\nפעולה זו תסייע לשמור על ביצועים טובים של המערכת.',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'מחק תורים ישנים', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Get all appointments
              const appointments = await getAllAppointments();
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              
              let deletedCount = 0;
              
              // Filter and delete old completed/cancelled appointments
              for (const appointment of appointments) {
                try {
                  const dateValue = appointment.date as any;
                  let appointmentDate: Date;
                  
                  if (dateValue && typeof dateValue.toDate === 'function') {
                    appointmentDate = dateValue.toDate();
                  } else if (dateValue) {
                    appointmentDate = new Date(dateValue);
                  } else {
                    continue;
                  }
                  
                  // Only delete completed or cancelled appointments older than 30 days
                  if (
                    (appointment.status === 'completed' || appointment.status === 'cancelled') &&
                    appointmentDate < thirtyDaysAgo
                  ) {
                    const { deleteDoc, doc } = await import('firebase/firestore');
                    const { db } = await import('../../config/firebase');
                    await deleteDoc(doc(db, 'appointments', appointment.id));
                    deletedCount++;
                  }
                } catch (error) {
                  console.error('Error deleting appointment:', error);
                }
              }
              
              Alert.alert(
                'הצלחה', 
                `נמחקו ${deletedCount} תורים ישנים בהצלחה!\n\nהמערכת נקייה ומוכנה לפעולה מיטבית.`
              );
              loadStatistics(); // Reload to show updated stats
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('שגיאה', 'לא ניתן למחוק את הנתונים. אנא נסה שוב מאוחר יותר.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const showMonthlyStats = () => {
    Alert.alert(
      'סטטיסטיקות חודשיות',
      stats.monthlyStats.map(month => 
        `${month.month}: ${formatCurrency(month.revenue)} (${month.appointments} תורים)`
      ).join('\n') || 'אין נתונים חודשיים',
      [{ text: 'סגור', style: 'default' }]
    );
  };

  const StatCard: React.FC<{ title: string; value: string; subtitle?: string; color: string; icon: string }> = ({ 
    title, value, subtitle, color, icon 
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon as any} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ScissorsLoader />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#dc3545" />
          <Text style={styles.errorText}>אין לך הרשאות מנהל</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('home')}>
            <Text style={styles.backButtonText}>חזור לעמוד הבית</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNav 
        title="סטטיסטיקות עסק"
        onBellPress={() => {}}
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => onNavigate('admin-home'))}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[colors.barberGold, colors.barberGoldDark]}
              style={styles.headerGradient}
            >
              <Text style={styles.headerTitle}>דשבורד עסקי</Text>
              <Text style={styles.headerSubtitle}>סטטיסטיקות מפורטות על העסק שלך</Text>
            </LinearGradient>
          </View>

          {/* Key Metrics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>מדדים עיקריים</Text>
            <View style={styles.statsGrid}>
              <StatCard
                title="הכנסות כוללות"
                value={formatCurrency(stats.totalRevenue)}
                subtitle="כל הזמנים"
                color="#28a745"
                icon="cash"
              />
              <StatCard
                title="משתמשים רשומים"
                value={stats.totalUsers.toString()}
                subtitle="משתמשים פעילים"
                color="#007bff"
                icon="people"
              />
              <StatCard
                title="תורים הושלמו"
                value={stats.completedAppointments.toString()}
                subtitle="תורים מוצלחים"
                color="#8B4513"
                icon="checkmark-circle"
              />
              <StatCard
                title="תורים ממתינים"
                value={stats.pendingAppointments.toString()}
                subtitle="תורים בהמתנה"
                color="#dc3545"
                icon="time"
              />
            </View>
          </View>

          {/* Revenue Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>הכנסות לפי תקופה</Text>
            <View style={styles.revenueGrid}>
              <View style={styles.revenueCard}>
                <Text style={styles.revenueLabel}>הכנסות השבוע</Text>
                <Text style={styles.revenueValue}>{formatCurrency(stats.weeklyRevenue)}</Text>
              </View>
              <View style={styles.revenueCard}>
                <Text style={styles.revenueLabel}>הכנסות החודש</Text>
                <Text style={styles.revenueValue}>{formatCurrency(stats.monthlyRevenue)}</Text>
              </View>
            </View>
          </View>


          {/* Action Buttons */}
          <View style={styles.refreshSection}>
            <TouchableOpacity style={styles.refreshButton} onPress={loadStatistics}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.refreshButtonText}>רענן נתונים</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.monthlyButton} onPress={showMonthlyStats}>
              <Ionicons name="calendar" size={20} color="#fff" />
              <Text style={styles.monthlyButtonText}>סטטיסטיקות חודשיות</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.clearButton} onPress={clearAllData}>
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.clearButtonText}>ניקוי נתונים</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    color: '#dc3545',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 100,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  headerGradient: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e3f2fd',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    textAlign: 'right',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'right',
  },
  statSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  revenueGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  revenueValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },
  treatmentRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  treatmentInfo: {
    flex: 1,
  },
  treatmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    textAlign: 'right',
  },
  treatmentCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  treatmentRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
  },
  barberRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  barberInfo: {
    flex: 1,
  },
  barberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    textAlign: 'right',
  },
  barberAppointments: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  barberRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
  },
  refreshSection: {
    marginTop: 24,
    flexDirection: 'column',
    gap: 12,
  },
  refreshButton: {
    backgroundColor: '#17a2b8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  monthlyButton: {
    backgroundColor: '#6f42c1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  monthlyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  clearButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default AdminStatisticsScreen; 
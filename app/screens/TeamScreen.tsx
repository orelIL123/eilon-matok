import { doc, getDoc, getFirestore } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Barber, getBarbers } from '../../services/firebase';
import ScissorsLoader from '../components/ScissorsLoader';
import TopNav from '../components/TopNav';

const { width, height } = Dimensions.get('window');

interface TeamScreenProps {
  onNavigate: (screen: string, params?: any) => void;
  onBack?: () => void;
}


const TeamScreen: React.FC<TeamScreenProps> = ({ onNavigate, onBack }) => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsBarber, setDetailsBarber] = useState<Barber | null>(null);
  const [atmosphereImage, setAtmosphereImage] = useState<string>('');

  useEffect(() => {
    loadBarbers();
    fetchAtmosphereImage();
  }, []);

  const fetchAtmosphereImage = async () => {
    try {
      const db = getFirestore();
      const settingsDocRef = doc(db, 'settings', 'images');
      const settingsDocSnap = await getDoc(settingsDocRef);
      if (settingsDocSnap.exists()) {
        const settingsData = settingsDocSnap.data();
        if (settingsData.atmosphereImage) {
          setAtmosphereImage(settingsData.atmosphereImage);
        }
      }
    } catch (error) {
      console.error('Error fetching atmosphere image:', error);
    }
  };

  const loadBarbers = async () => {
    try {
      const barbersData = await getBarbers();
      setBarbers(barbersData);
    } catch (error) {
      console.error('Error loading barbers:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת הספרים');
    } finally {
      setLoading(false);
    }
  };

  const handleBarberPress = (barber: Barber) => {
    setSelectedBarber(barber);
    setModalVisible(true);
  };

  const handleBookWithBarber = () => {
    if (selectedBarber) {
      setModalVisible(false);
      onNavigate('booking', { barberId: selectedBarber.id });
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={[styles.star, i <= rating ? styles.starFilled : styles.starEmpty]}>
          ★
        </Text>
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav 
          title="הצוות שלנו" 
          onBellPress={() => {}} 
          onMenuPress={() => {}}
          showBackButton={true}
          onBackPress={onBack || (() => onNavigate('home'))}
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
        title="הצוות שלנו" 
        onBellPress={() => {}} 
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => onNavigate('home'))}
      />
      
      {/* Hero Section */}
      <View style={styles.heroSection}>
        {atmosphereImage ? (
          <Image
            source={{ uri: atmosphereImage }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: '#333' }]} />
        )}
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>הכירו את הצוות המקצועי שלנו</Text>
          <Text style={styles.heroSubtitle}>ספרים מומחים עם שנות ניסיון</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <Text style={styles.sectionTitle}>הספרים שלנו</Text>
          
          {barbers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>אין ספרים זמינים כרגע</Text>
            </View>
          ) : (
            <View style={styles.barbersGrid}>
              {barbers.map((barber) => (
                <TouchableOpacity
                  key={barber.id}
                  style={styles.barberCard}
                  onPress={() => handleBarberPress(barber)}
                >
                  <View style={styles.barberImageContainer}>
                    <View style={styles.barberImage}>
                      {barber.image ? (
                        <Image
                          source={{ uri: barber.image }}
                          style={styles.barberPhoto}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.barberPlaceholder}>✂️</Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.barberInfo}>
                    <Text style={styles.barberName}>{barber.name}</Text>
                    <Text style={styles.barberExperience}>{barber.experience}</Text>
                    
                    <View style={styles.ratingContainer}>
                      <View style={styles.stars}>
                        {renderStars(barber.rating)}
                      </View>
                      <Text style={styles.ratingText}>{barber.rating}/5</Text>
                    </View>
                    
                    <View style={styles.specialtiesContainer}>
                      {barber.specialties && barber.specialties.slice(0, 2).map((specialty, index) => (
                        <View key={index} style={styles.specialtyTag}>
                          <Text style={styles.specialtyText}>{specialty}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.detailsButton} onPress={() => setDetailsBarber(barber)}>
                      <Text style={styles.detailsButtonText}>לפרטים</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Barber Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedBarber && (
              <>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
                
                <View style={styles.modalHeader}>
                  <View style={styles.modalBarberImage}>
                    {selectedBarber.image ? (
                      <Image
                        source={{ uri: selectedBarber.image }}
                        style={styles.barberPhoto}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.modalBarberPlaceholder}>✂️</Text>
                    )}
                  </View>
                  <Text style={styles.modalBarberName}>{selectedBarber.name}</Text>
                  <Text style={styles.modalBarberExperience}>{selectedBarber.experience}</Text>
                </View>

                <View style={styles.modalRating}>
                  <View style={styles.stars}>
                    {renderStars(selectedBarber.rating)}
                  </View>
                  <Text style={styles.ratingText}>{selectedBarber.rating}/5</Text>
                </View>

                <View style={styles.modalSpecialties}>
                  <Text style={styles.modalSpecialtiesTitle}>התמחויות:</Text>
                  <View style={styles.specialtiesGrid}>
                    {(selectedBarber.specialties || []).map((specialty, index) => (
                      <View key={index} style={styles.modalSpecialtyTag}>
                        <Text style={styles.modalSpecialtyText}>{specialty}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.bookButton}
                    onPress={handleBookWithBarber}
                  >
                    <Text style={styles.bookButtonText}>
                      הזמן תור
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Details Barber Modal */}
      <Modal
        visible={!!detailsBarber}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsBarber(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: 320, alignItems: 'center' }}>
            {detailsBarber?.image && (
              <Image source={{ uri: detailsBarber.image }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 12 }} />
            )}
            <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 6 }}>{detailsBarber?.name}</Text>
            <Text style={{ fontSize: 16, color: '#666', marginBottom: 8 }}>{detailsBarber?.experience}</Text>
            {detailsBarber?.phone && (
              <Text style={{ fontSize: 16, color: '#8B4513', marginBottom: 8 }}>טלפון: {detailsBarber.phone}</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              {/* אייקון וואטסאפ */}
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Text style={{ color: '#fff', fontSize: 20 }}>🟢</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setDetailsBarber(null)} style={{ marginTop: 18 }}>
              <Text style={{ color: '#8B4513', fontWeight: 'bold' }}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    color: '#333',
    fontWeight: '500',
  },
  heroSection: {
    height: height * 0.25,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 20,
    textAlign: 'right',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  barbersGrid: {
    flexDirection: 'column', // Single column for Ron
    alignItems: 'center',
    paddingVertical: 16,
  },
  barberCard: {
    width: Math.min((width - 32), 350), // Make it bigger and centered
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 24,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  barberImageContainer: {
    position: 'relative',
    height: 240, // Much bigger photo for Ron
  },
  barberImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  barberPlaceholder: {
    fontSize: 40,
    color: '#666',
  },
  barberPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 6,
  },
  unavailableBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unavailableText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  barberInfo: {
    padding: 16,
  },
  barberName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    textAlign: 'center',
  },
  barberExperience: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 16,
    marginHorizontal: 1,
  },
  starFilled: {
    color: '#8B4513',
  },
  starEmpty: {
    color: '#ddd',
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  specialtyTag: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
  },
  specialtyText: {
    fontSize: 12,
    color: '#666',
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
    maxHeight: height * 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  modalBarberImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  modalBarberPlaceholder: {
    fontSize: 50,
    color: '#666',
  },
  modalBarberName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBarberExperience: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  modalSpecialties: {
    marginBottom: 24,
  },
  modalSpecialtiesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
    textAlign: 'right',
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  modalSpecialtyTag: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
    marginBottom: 8,
  },
  modalSpecialtyText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  modalActions: {
    marginTop: 16,
  },
  bookButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#ccc',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsButton: {
    backgroundColor: '#8B4513',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  detailsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default TeamScreen;
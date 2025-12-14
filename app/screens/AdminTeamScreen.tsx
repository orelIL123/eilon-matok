import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { memo, useEffect, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import {
    addBarberProfile,
    Barber,
    checkIsAdmin,
    deleteBarberProfile,
    getBarbers,
    getStorageImages,
    getTreatments,
    onAuthStateChange,
    Treatment,
    updateBarberProfile,
    uploadImageToStorage
} from '../../services/firebase';
import ScissorsLoader from '../components/ScissorsLoader';
import ToastMessage from '../components/ToastMessage';
import TopNav from '../components/TopNav';

interface AdminTeamScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

// Optimized Image Component with lazy loading
const OptimizedImage = memo(({ source, style, resizeMode = 'cover' }: {
  source: any;
  style: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <View style={[style, { backgroundColor: '#f0f0f0' }]}>
      {!isLoaded && !hasError && (
        <View style={[style, { 
          position: 'absolute', 
          backgroundColor: '#f0f0f0', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }]}>
          <Text style={{ color: '#999', fontSize: 12 }}>טוען...</Text>
        </View>
      )}
      <Image
        source={source}
        style={[style, { opacity: isLoaded ? 1 : 0 }]}
        resizeMode={resizeMode}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        fadeDuration={200}
      />
    </View>
  );
});
OptimizedImage.displayName = 'OptimizedImage';

const AdminTeamScreen: React.FC<AdminTeamScreenProps> = ({ onNavigate, onBack }) => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [workerImages, setWorkerImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    experience: '',
    rating: '5',
    specialties: [''],
    image: '',
    available: true,
    pricing: {} as { [treatmentId: string]: number },
    phone: ''
  });

  // Check admin status
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        console.log('🔍 AdminTeamScreen - User UID:', user.uid);
        const adminStatus = await checkIsAdmin(user.uid);
        console.log('🔍 AdminTeamScreen - Admin status:', adminStatus);
        setIsAdmin(adminStatus);
        if (!adminStatus) {
          Alert.alert(
            'אין הרשאות',
            `אין לך הרשאות מנהל.\n\nUID: ${user.uid}\n\nאנא התחבר עם משתמש אדמין.`,
            [{ text: 'חזרה', onPress: () => onNavigate('admin-home') }]
          );
        }
      } else {
        console.log('🔍 AdminTeamScreen - No user signed in');
        Alert.alert('שגיאה', 'אנא התחבר למערכת');
        onNavigate('home');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    loadBarbers();
  }, []);

  // Debug modal visibility
  useEffect(() => {
    console.log('🔵 modalVisible changed to:', modalVisible);
  }, [modalVisible]);

  const loadBarbers = async () => {
    try {
      setLoading(true);
      const [barbersData, treatmentsData, imagesData] = await Promise.all([
        getBarbers(),
        getTreatments(),
        getStorageImages('workers')
      ]);
      console.log('Loaded barbers:', barbersData);
      console.log('Loaded worker images:', imagesData);
      
      // Auto-fix barber image if needed
      const mainBarber = barbersData.find(b => b.isMainBarber);
      if (mainBarber && imagesData.length > 0 && !mainBarber.image) {
        const barberImage = imagesData[0]; // Use first available image
        if (barberImage) {
          console.log('Auto-fixing barber image:', barberImage);
          try {
            await updateBarberProfile(mainBarber.id, { image: barberImage });
            // Reload barbers to reflect changes
            const updatedBarbers = await getBarbers();
            setBarbers(updatedBarbers);
          } catch (error) {
            console.error('Error updating barber image:', error);
          }
        }
      }
      setBarbers(barbersData);
      setTreatments(treatmentsData);
      setWorkerImages(imagesData);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('שגיאה בטעינת הנתונים', 'error');
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

  const openAddModal = () => {
    console.log('🔵 openAddModal called');
    console.log('🔵 Current treatments:', treatments.length);
    console.log('🔵 Current modalVisible state:', modalVisible);
    setEditingBarber(null);
    const defaultPricing: { [treatmentId: string]: number } = {};
    treatments.forEach(treatment => {
      defaultPricing[treatment.id] = treatment.price;
    });
    
    setFormData({
      name: '',
      experience: '',
      rating: '5',
      specialties: [''],
      image: '',
      available: true,
      pricing: defaultPricing,
      phone: ''
    });
    console.log('🔵 Setting modalVisible to true');
    setModalVisible(true);
    console.log('🔵 modalVisible should now be true');
    // Force a re-render check
    setTimeout(() => {
      console.log('🔵 After timeout - modalVisible:', modalVisible);
    }, 100);
  };

  const openEditModal = (barber: Barber) => {
    setEditingBarber(barber);
    const currentPricing = barber.pricing || {};
    const defaultPricing: { [treatmentId: string]: number } = {};
    treatments.forEach(treatment => {
      defaultPricing[treatment.id] = currentPricing[treatment.id] || treatment.price;
    });
    
    setFormData({
      name: barber.name || '',
      experience: barber.experience || '',
      rating: (barber.rating || 5).toString(),
      specialties: (barber.specialties || []).length > 0 ? barber.specialties : [''],
      image: barber.image || '',
      available: barber.available !== undefined ? barber.available : true,
      pricing: defaultPricing,
      phone: barber.phone || ''
    });
    setModalVisible(true);
  };

  const addSpecialty = () => {
    setFormData({
      ...formData,
      specialties: [...formData.specialties, '']
    });
  };

  const removeSpecialty = (index: number) => {
    const newSpecialties = formData.specialties.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      specialties: newSpecialties.length > 0 ? newSpecialties : ['']
    });
  };

  const updateSpecialty = (index: number, value: string) => {
    const newSpecialties = [...formData.specialties];
    newSpecialties[index] = value;
    setFormData({
      ...formData,
      specialties: newSpecialties
    });
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      showToast('נא למלא שם הספר', 'error');
      return false;
    }
    // Experience is now optional - removed validation
    if (!formData.rating || isNaN(Number(formData.rating)) || Number(formData.rating) < 1 || Number(formData.rating) > 5) {
      showToast('נא למלא דירוג תקין (1-5)', 'error');
      return false;
    }
    const validSpecialties = formData.specialties.filter(s => s.trim());
    if (validSpecialties.length === 0) {
      showToast('נא למלא לפחות התמחות אחת', 'error');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const barberData: any = {
        name: formData.name.trim(),
        rating: parseInt(formData.rating),
        specialties: formData.specialties.filter(s => s.trim()),
        image: formData.image.trim() || (workerImages[0] || 'https://via.placeholder.com/150x150'),
        available: formData.available,
        pricing: formData.pricing,
        phone: formData.phone.trim()
      };
      
      // Add experience only if provided (optional field)
      if (formData.experience.trim()) {
        barberData.experience = formData.experience.trim();
      }

      if (editingBarber) {
        await updateBarberProfile(editingBarber.id, barberData);
        setBarbers(prev => 
          prev.map(b => 
            b.id === editingBarber.id ? { ...b, ...barberData } : b
          )
        );
        showToast('הספר עודכן בהצלחה');
      } else {
        const newBarberId = await addBarberProfile(barberData);
        setBarbers(prev => [...prev, { id: newBarberId, ...barberData }]);
        showToast('הספר נוסף בהצלחה');
      }

      // Refresh worker images after save
      const updatedImages = await getStorageImages('workers');
      setWorkerImages(updatedImages);

      setModalVisible(false);
    } catch (error) {
      console.error('Error saving barber:', error);
      showToast('שגיאה בשמירת הספר', 'error');
    }
  };

  const handleDelete = async (barberId: string, barberName: string) => {
    Alert.alert(
      'מחיקת ספר',
      `האם אתה בטוח שברצונך למחוק את הספר "${barberName}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBarberProfile(barberId);
              setBarbers(prev => prev.filter(b => b.id !== barberId));
              showToast('הספר נמחק בהצלחה');
            } catch (error) {
              console.error('Error deleting barber:', error);
              showToast('שגיאה במחיקת הספר', 'error');
            }
          }
        }
      ]
    );
  };

  const toggleAvailability = async (barberId: string, currentAvailability: boolean) => {
    try {
      await updateBarberProfile(barberId, { available: !currentAvailability });
      setBarbers(prev => 
        prev.map(b => 
          b.id === barberId ? { ...b, available: !currentAvailability } : b
        )
      );
      showToast(!currentAvailability ? 'הספר הוגדר כזמין' : 'הספר הוגדר כלא זמין');
    } catch (error) {
      console.error('Error toggling availability:', error);
      showToast('שגיאה בעדכון זמינות', 'error');
    }
  };

  const handlePhoneCall = (phone: string) => {
    const phoneNumber = `tel:${phone}`;
    Linking.openURL(phoneNumber).catch(err => {
      console.error('Error opening dialer:', err);
      showToast('לא ניתן לפתוח את החייגן', 'error');
    });
  };

  const handleWhatsApp = (phone: string) => {
    const whatsappURL = `whatsapp://send?phone=${phone}`;
    Linking.openURL(whatsappURL).catch(err => {
      console.error('Error opening WhatsApp:', err);
      showToast('לא ניתן לפתוח את WhatsApp', 'error');
    });
  };

  const pickImageFromDevice = async (): Promise<{ uri: string; mimeType?: string } | null> => {
    try {
      console.log('📱 Requesting media library permissions...');
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        showToast('נדרשת הרשאה לגישה לגלריה', 'error');
        return null;
      }

      // Double check permission status
      if (permissionResult.status !== 'granted') {
        showToast('הרשאת גישה נדחתה', 'error');
        return null;
      }

      console.log('📱 Permissions granted, launching image picker...');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      console.log('📱 Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const imageUri = asset.uri;
        const mimeType = asset.mimeType || 'image/jpeg';
        console.log('📤 Selected image URI:', imageUri);
        console.log('📄 MIME type:', mimeType);
        return { uri: imageUri, mimeType };
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('שגיאה בבחירת התמונה', 'error');
    }
    return null;
  };

  const uploadWorkerImageFromDevice = async () => {
    try {
      const imageData = await pickImageFromDevice();
      if (!imageData) return;

      showToast('מעלה תמונה...', 'success');
      
      // Determine file extension from mimeType
      let extension = 'jpg';
      if (imageData.mimeType?.includes('png')) {
        extension = 'png';
      } else if (imageData.mimeType?.includes('webp')) {
        extension = 'webp';
      }
      
      const fileName = `worker_${Date.now()}.${extension}`;
      console.log('📁 Uploading to workers folder with filename:', fileName);
      
      const downloadURL = await uploadImageToStorage(imageData.uri, 'workers', fileName, imageData.mimeType);
      console.log('✅ Upload successful, URL:', downloadURL);
      
      setFormData({
        ...formData,
        image: downloadURL
      });
      
      // Refresh worker images
      const updatedImages = await getStorageImages('workers');
      setWorkerImages(updatedImages);
      
      showToast('התמונה הועלתה בהצלחה', 'success');
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast(`שגיאה בהעלאת התמונה: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`, 'error');
    }
  };

  const renderStars = (rating: number | undefined) => {
    const validRating = rating || 5;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={[styles.star, i <= validRating ? styles.starFilled : styles.starEmpty]}>
          ★
        </Text>
      );
    }
    return stars;
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav 
        title="ניהול הצוות"
        onBellPress={() => {}}
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => onNavigate('admin-home'))}
      />
      
      <View style={styles.content}>
        {/* Add Barber Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>הוסף ספר חדש</Text>
          </TouchableOpacity>
        </View>

        {/* Barbers List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ScissorsLoader />
          </View>
        ) : (
          <ScrollView style={styles.barbersList}>
            {barbers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#ccc" />
                <Text style={styles.emptyStateText}>אין ספרים במערכת</Text>
                <TouchableOpacity style={styles.emptyAddButton} onPress={openAddModal}>
                  <Text style={styles.emptyAddButtonText}>הוסף ספר ראשון</Text>
                </TouchableOpacity>
              </View>
            ) : (
              barbers.map((barber) => (
                <View key={barber.id} style={styles.barberCard}>
                  <View style={styles.barberHeader}>
                    <View style={styles.barberImageContainer}>
                      <Image
                        source={{ uri: barber.image || barber.photoUrl || 'https://via.placeholder.com/150x150' }}
                        style={styles.barberImage}
                        defaultSource={{ uri: 'https://via.placeholder.com/150x150' }}
                        onError={(error) => {
                          console.log('Image loading error for barber:', barber.name, 'URL:', barber.image || barber.photoUrl, 'Error:', error);
                        }}
                        onLoad={() => {
                          console.log('Image loaded successfully for barber:', barber.name, 'URL:', barber.image || barber.photoUrl);
                        }}
                      />
                      <TouchableOpacity
                        style={[
                          styles.availabilityBadge,
                          (barber.available !== false) ? styles.availableBadge : styles.unavailableBadge
                        ]}
                        onPress={() => toggleAvailability(barber.id, barber.available)}
                      >
                        <Text style={styles.availabilityText}>
                          {(barber.available !== false) ? 'זמין' : 'לא זמין'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.barberInfo}>
                      <Text style={styles.barberName}>{barber.name}</Text>
                      <Text style={styles.barberExperience}>{barber.experience || barber.bio || ''}</Text>
                      
                      {barber.phone && (
                        <View style={styles.phoneContainer}>
                          <Text style={styles.phoneText}>{barber.phone}</Text>
                          <View style={styles.phoneActions}>
                            <TouchableOpacity
                              style={styles.phoneButton}
                              onPress={() => barber.phone && handlePhoneCall(barber.phone)}
                            >
                              <Ionicons name="call" size={16} color="#007bff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.whatsappButton}
                              onPress={() => barber.phone && handleWhatsApp(barber.phone)}
                            >
                              <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      
                      <View style={styles.ratingContainer}>
                        <View style={styles.stars}>
                          {renderStars(barber.rating)}
                        </View>
                        <Text style={styles.ratingText}>{barber.rating || 5}/5</Text>
                      </View>
                      
                      <View style={styles.specialtiesContainer}>
                        {(barber.specialties || []).slice(0, 2).map((specialty, index) => (
                          <View key={index} style={styles.specialtyTag}>
                            <Text style={styles.specialtyText}>{specialty}</Text>
                          </View>
                        ))}
                        {(barber.specialties || []).length > 2 && (
                          <View style={styles.specialtyTag}>
                            <Text style={styles.specialtyText}>+{(barber.specialties || []).length - 2}</Text>
                          </View>
                        )}
                      </View>
                      
                      {barber.pricing && Object.keys(barber.pricing).length > 0 && (
                        <View style={styles.customPricingIndicator}>
                          <Text style={styles.customPricingText}>מחירים מותאמים אישית</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.barberActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => openEditModal(barber)}
                      >
                        <Ionicons name="create" size={20} color="#007bff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(barber.id, barber.name)}
                      >
                        <Ionicons name="trash" size={20} color="#dc3545" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Add/Edit Barber Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          console.log('🔵 Modal onRequestClose called');
          setModalVisible(false);
        }}
        onShow={() => {
          console.log('🔵 Modal onShow called - Modal is now visible!');
        }}
      >
        {modalVisible && (
          <KeyboardAvoidingView 
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBarber ? 'עריכת ספר' : 'הוספת ספר חדש'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>שם הספר</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="לדוגמה: דוד כהן"
                  textAlign="right"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ניסיון (אופציונלי)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.experience}
                  onChangeText={(text) => setFormData({ ...formData, experience: text })}
                  placeholder="לדוגמה: 5 שנות ניסיון"
                  textAlign="right"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>מספר טלפון</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="לדוגמה: 050-831-5002"
                  keyboardType="phone-pad"
                  textAlign="right"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>דירוג (1-5)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.rating}
                  onChangeText={(text) => setFormData({ ...formData, rating: text })}
                  placeholder="5"
                  keyboardType="numeric"
                  textAlign="right"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>התמחויות</Text>
                {formData.specialties.map((specialty, index) => (
                  <View key={index} style={styles.specialtyInput}>
                    <TextInput
                      style={[styles.textInput, styles.specialtyTextInput]}
                      value={specialty}
                      onChangeText={(text) => updateSpecialty(index, text)}
                      placeholder="לדוגמה: תספורת קלאסית"
                      textAlign="right"
                    />
                    {formData.specialties.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeSpecialtyButton}
                        onPress={() => removeSpecialty(index)}
                      >
                        <Ionicons name="remove-circle" size={24} color="#dc3545" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addSpecialtyButton} onPress={addSpecialty}>
                  <Ionicons name="add" size={20} color="#007bff" />
                  <Text style={styles.addSpecialtyText}>הוסף התמחות</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>תמונה</Text>
                
                {/* Upload from device button */}
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={uploadWorkerImageFromDevice}
                >
                  <Ionicons name="cloud-upload" size={20} color="#007bff" />
                  <Text style={styles.uploadButtonText}>העלה תמונה מהמכשיר</Text>
                </TouchableOpacity>
                
                {workerImages.length > 0 && (
                  <View>
                    <Text style={styles.orText}>או בחר מתמונות קיימות</Text>
                    <View style={styles.imageSelector}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {workerImages.map((imageUrl, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.imageOption,
                              formData.image === imageUrl && styles.selectedImageOption
                            ]}
                            onPress={() => setFormData({ ...formData, image: imageUrl })}
                          >
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.imagePreview}
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <Text style={styles.imageHint}>בחר תמונה מ-Firebase Storage</Text>
                    </View>
                  </View>
                )}
                
                {/* Current image preview */}
                {formData.image && (
                  <View style={styles.currentImageContainer}>
                    <Text style={styles.currentImageLabel}>תמונה נבחרת:</Text>
                    <Image
                      source={{ uri: formData.image }}
                      style={styles.currentImagePreview}
                    />
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>מחירים מותאמים אישית</Text>
                <Text style={styles.pricingHint}>
                  כאן תוכל להגדיר מחירים מיוחדים עבור הספר הזה. אם לא תגדיר מחיר, ישתמש במחיר הברירת מחדל של הטיפול.
                </Text>
                {treatments.map((treatment) => (
                  <View key={treatment.id} style={styles.pricingRow}>
                    <View style={styles.pricingInfo}>
                      <Text style={styles.treatmentName}>{treatment.name}</Text>
                      <Text style={styles.defaultPrice}>מחיר בסיס: ₪{treatment.price}</Text>
                    </View>
                    <TextInput
                      style={styles.priceInput}
                      value={formData.pricing[treatment.id]?.toString() || ''}
                      onChangeText={(text) => {
                        const price = text === '' ? treatment.price : parseInt(text) || treatment.price;
                        setFormData({
                          ...formData,
                          pricing: {
                            ...formData.pricing,
                            [treatment.id]: price
                          }
                        });
                      }}
                      placeholder={treatment.price.toString()}
                      keyboardType="numeric"
                      textAlign="center"
                    />
                  </View>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.availabilityToggle}
                  onPress={() => setFormData({ ...formData, available: !formData.available })}
                >
                  <Text style={styles.inputLabel}>זמין לתורים</Text>
                  <View style={[
                    styles.toggleSwitch,
                    formData.available ? styles.toggleOn : styles.toggleOff
                  ]}>
                    <View style={[
                      styles.toggleIndicator,
                      formData.available ? styles.toggleIndicatorOn : styles.toggleIndicatorOff
                    ]} />
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        )}
      </Modal>

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
  content: {
    flex: 1,
    paddingTop: 100,
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  barbersList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyAddButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  barberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  barberHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  barberImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  barberImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
  },
  availabilityBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  availableBadge: {
    backgroundColor: '#8B4513',
  },
  unavailableBadge: {
    backgroundColor: '#F44336',
  },
  availabilityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  barberInfo: {
    flex: 1,
  },
  barberName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    textAlign: 'right',
  },
  barberExperience: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'right',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    marginLeft: 8,
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
    justifyContent: 'flex-end',
  },
  specialtyTag: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 4,
    marginBottom: 4,
  },
  specialtyText: {
    fontSize: 12,
    color: '#666',
  },
  barberActions: {
    flexDirection: 'column',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E8D5C4',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '95%',
    maxWidth: 450,
    maxHeight: '95%',
    minHeight: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  modalBody: {
    flex: 1,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'right',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  specialtyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  specialtyTextInput: {
    flex: 1,
    marginRight: 8,
  },
  removeSpecialtyButton: {
    padding: 4,
  },
  addSpecialtyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  addSpecialtyText: {
    color: '#007bff',
    fontSize: 14,
    marginLeft: 4,
  },
  availabilityToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: '#8B4513',
  },
  toggleOff: {
    backgroundColor: '#ddd',
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleIndicatorOn: {
    alignSelf: 'flex-end',
  },
  toggleIndicatorOff: {
    alignSelf: 'flex-start',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#007bff',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageSelector: {
    marginBottom: 8,
  },
  imageOption: {
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedImageOption: {
    borderColor: '#007bff',
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  imageHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  pricingHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'right',
    lineHeight: 20,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pricingInfo: {
    flex: 1,
  },
  treatmentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'right',
  },
  defaultPrice: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 2,
  },
  priceInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  customPricingIndicator: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  customPricingText: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
    textAlign: 'right',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  phoneText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
    flex: 1,
  },
  phoneActions: {
    flexDirection: 'row',
    gap: 8,
  },
  phoneButton: {
    backgroundColor: '#e3f2fd',
    padding: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  whatsappButton: {
    backgroundColor: '#e8f5e8',
    padding: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  uploadButtonText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  orText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginVertical: 8,
  },
  currentImageContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  currentImageLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    textAlign: 'right',
  },
  currentImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
  },
});

export default AdminTeamScreen;
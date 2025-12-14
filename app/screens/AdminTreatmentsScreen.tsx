import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
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
    Treatment,
    addTreatment,
    deleteTreatment,
    getTreatments,
    updateTreatment,
    uploadImageToStorage
} from '../../services/firebase';
import ScissorsLoader from '../components/ScissorsLoader';
import ToastMessage from '../components/ToastMessage';
import TopNav from '../components/TopNav';
import { SLOT_SIZE_MINUTES, isValidDuration } from '../constants/scheduling';

interface AdminTreatmentsScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

const AdminTreatmentsScreen: React.FC<AdminTreatmentsScreenProps> = ({ onNavigate, onBack }) => {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    duration: '',
    price: '',
    description: '',
    image: ''
  });

  // Refs for keyboard navigation
  const nameInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const durationInputRef = useRef<TextInput>(null);
  const priceInputRef = useRef<TextInput>(null);
  const imageInputRef = useRef<TextInput>(null);
  const [currentField, setCurrentField] = useState<string>('name');

  useEffect(() => {
    loadTreatments();
  }, []);

  const loadTreatments = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading treatments...');
      // Force fresh data by disabling cache
      const treatmentsData = await getTreatments(false);
      console.log('📦 Loaded treatments:', treatmentsData.length);
      setTreatments(treatmentsData);
    } catch (error) {
      console.error('Error loading treatments:', error);
      showToast('שגיאה בטעינת הטיפולים', 'error');
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

  const pickImageFromDevice = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('שגיאה בבחירת התמונה', 'error');
    }
    return null;
  };

  const uploadImageFromDevice = async () => {
    try {
      const imageUri = await pickImageFromDevice();
      if (!imageUri) return;

      showToast('מעלה תמונה...', 'success');
      
      const fileName = `treatment_${Date.now()}.jpg`;
      const folderPath = 'treatments';
      
      const downloadURL = await uploadImageToStorage(imageUri, folderPath, fileName);
      
      setFormData({
        ...formData,
        image: downloadURL
      });
      
      showToast('התמונה הועלתה בהצלחה', 'success');
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast('שגיאה בהעלאת התמונה', 'error');
    }
  };


  const focusNextField = () => {
    switch (currentField) {
      case 'name':
        descriptionInputRef.current?.focus();
        break;
      case 'description':
        durationInputRef.current?.focus();
        break;
      case 'duration':
        priceInputRef.current?.focus();
        break;
      case 'price':
        imageInputRef.current?.focus();
        break;
      case 'image':
        // Last field, save the treatment
        handleSave();
        break;
    }
  };

  const focusPreviousField = () => {
    switch (currentField) {
      case 'description':
        nameInputRef.current?.focus();
        break;
      case 'duration':
        descriptionInputRef.current?.focus();
        break;
      case 'price':
        durationInputRef.current?.focus();
        break;
      case 'image':
        priceInputRef.current?.focus();
        break;
    }
  };

  const openAddModal = () => {
    console.log('🔧 Opening add treatment modal...');
    setEditingTreatment(null);
    const initialFormData = {
      name: '',
      duration: '',
      price: '',
      description: '',
      image: ''
    };
    console.log('📝 Initial form data:', initialFormData);
    setFormData(initialFormData);
    setModalVisible(true);
    console.log('✅ Modal should be visible now');
  };

  const openEditModal = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setFormData({
      name: treatment.name,
      duration: treatment.duration.toString(),
      price: treatment.price.toString(),
      description: treatment.description,
      image: treatment.image
    });
    setModalVisible(true);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      showToast('נא למלא שם טיפול', 'error');
      return false;
    }
    if (!formData.duration.trim() || isNaN(Number(formData.duration))) {
      showToast('נא למלא זמן טיפול תקין', 'error');
      return false;
    }
    if (!formData.price.trim() || isNaN(Number(formData.price))) {
      showToast('נא למלא מחיר תקין', 'error');
      return false;
    }
    if (!formData.description.trim()) {
      showToast('נא למלא תיאור טיפול', 'error');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const duration = parseInt(formData.duration);
    
    // Validate duration is a multiple of slot size minutes (5 minutes)
    if (!isValidDuration(duration)) {
      showToast(`משך הטיפול חייב להיות כפולה של ${SLOT_SIZE_MINUTES} דקות (5, 10, 15, 20, 25, 30, וכו')`, 'error');
      return;
    }

    try {
      console.log('💾 Saving treatment...');
      const treatmentData = {
        name: formData.name.trim(),
        duration: duration,
        price: parseFloat(formData.price),
        description: formData.description.trim(),
        image: formData.image.trim() || 'https://via.placeholder.com/200x150'
      };

      console.log('📊 Treatment data:', treatmentData);

      if (editingTreatment) {
        console.log('✏️ Updating existing treatment:', editingTreatment.id);
        await updateTreatment(editingTreatment.id, treatmentData);
        setTreatments(prev =>
          prev.map(t =>
            t.id === editingTreatment.id ? { ...t, ...treatmentData } : t
          )
        );
        showToast('הטיפול עודכן בהצלחה');
      } else {
        console.log('➕ Adding new treatment...');
        const newTreatmentId = await addTreatment(treatmentData);
        console.log('✅ New treatment ID:', newTreatmentId);
        setTreatments(prev => [...prev, { id: newTreatmentId, ...treatmentData }]);
        showToast('הטיפול נוסף בהצלחה');
      }

      // Reload treatments to ensure we have fresh data
      await loadTreatments();

      setModalVisible(false);
    } catch (error) {
      console.error('❌ Error saving treatment:', error);
      showToast('שגיאה בשמירת הטיפול', 'error');
    }
  };

  const handleDelete = async (treatmentId: string, treatmentName: string) => {
    Alert.alert(
      'מחיקת טיפול',
      `האם אתה בטוח שברצונך למחוק את הטיפול "${treatmentName}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTreatment(treatmentId);
              setTreatments(prev => prev.filter(t => t.id !== treatmentId));
              showToast('הטיפול נמחק בהצלחה');
            } catch (error) {
              console.error('Error deleting treatment:', error);
              showToast('שגיאה במחיקת הטיפול', 'error');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav 
        title="ניהול טיפולים"
        onBellPress={() => {}}
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => onNavigate('admin-home'))}
      />
      
      <View style={styles.content}>
        {/* Add Treatment Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>הוסף טיפול חדש</Text>
          </TouchableOpacity>
        </View>

        {/* Treatments List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ScissorsLoader />
          </View>
        ) : (
          <ScrollView style={styles.treatmentsList}>
            {treatments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cut-outline" size={64} color="#ccc" />
                <Text style={styles.emptyStateText}>אין טיפולים במערכת</Text>
                <TouchableOpacity style={styles.emptyAddButton} onPress={openAddModal}>
                  <Text style={styles.emptyAddButtonText}>הוסף טיפול ראשון</Text>
                </TouchableOpacity>
              </View>
            ) : (
              treatments.map((treatment) => (
                <View key={treatment.id} style={styles.treatmentCard}>
                  <View style={styles.treatmentHeader}>
                    <Text style={styles.treatmentName}>{treatment.name}</Text>
                    <View style={styles.treatmentActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => openEditModal(treatment)}
                      >
                        <Ionicons name="create" size={20} color="#007bff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(treatment.id, treatment.name)}
                      >
                        <Ionicons name="trash" size={20} color="#dc3545" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {treatment.image && (
                    <View style={styles.treatmentImageContainer}>
                      <Image
                        source={{ uri: treatment.image }}
                        style={styles.treatmentImage}
                        defaultSource={{ uri: 'https://via.placeholder.com/200x150' }}
                      />
                    </View>
                  )}
                  
                  <Text style={styles.treatmentDescription}>
                    {treatment.description}
                  </Text>
                  
                  <View style={styles.treatmentDetails}>
                    <View style={styles.detailItem}>
                      <Ionicons name="time" size={16} color="#666" />
                      <Text style={styles.detailText}>{treatment.duration} דקות</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="cash" size={16} color="#666" />
                      <Text style={styles.detailText}>₪{treatment.price}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                      <Text style={styles.detailText}>זמין</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Add/Edit Treatment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTreatment ? 'עריכת טיפול' : 'הוספת טיפול חדש'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* פרטי הטיפול */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>פרטי הטיפול</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>שם הטיפול *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.name}
                    onChangeText={(text) => {
                      console.log('📝 Updating name:', text);
                      setFormData({ ...formData, name: text });
                    }}
                    placeholder="לדוגמה: תספורת קלאסית"
                    textAlign="right"
                    placeholderTextColor="#999"
                    ref={nameInputRef}
                    onFocus={() => setCurrentField('name')}
                    returnKeyType="next"
                    onSubmitEditing={focusNextField}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>תיאור הטיפול *</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    placeholder="תיאור מפורט של הטיפול"
                    multiline
                    numberOfLines={4}
                    textAlign="right"
                    placeholderTextColor="#999"
                    ref={descriptionInputRef}
                    onFocus={() => setCurrentField('description')}
                    returnKeyType="next"
                    onSubmitEditing={focusNextField}
                  />
                </View>
              </View>

              {/* מחיר וזמן */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>מחיר וזמן</Text>
                
                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.inputLabel}>זמן הטיפול (דקות) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formData.duration}
                      onChangeText={(text) => setFormData({ ...formData, duration: text })}
                      placeholder="30"
                      keyboardType="numeric"
                      textAlign="right"
                      placeholderTextColor="#999"
                      ref={durationInputRef}
                      onFocus={() => setCurrentField('duration')}
                      returnKeyType="next"
                      onSubmitEditing={focusNextField}
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.inputLabel}>מחיר (₪) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formData.price}
                      onChangeText={(text) => setFormData({ ...formData, price: text })}
                      placeholder="80"
                      keyboardType="numeric"
                      textAlign="right"
                      placeholderTextColor="#999"
                      ref={priceInputRef}
                      onFocus={() => setCurrentField('price')}
                      returnKeyType="next"
                      onSubmitEditing={focusNextField}
                    />
                  </View>
                </View>
              </View>

              {/* תמונה */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>תמונה (אופציונלי)</Text>
                
                {/* כפתור העלאת תמונה */}
                <TouchableOpacity 
                  style={styles.uploadImageButton}
                  onPress={uploadImageFromDevice}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color="#007bff" />
                  <Text style={styles.uploadImageText}>העלה תמונה מהמכשיר</Text>
                </TouchableOpacity>

                {/* תצוגה מקדימה של התמונה */}
                {formData.image ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image 
                      source={{ uri: formData.image }}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => setFormData({ ...formData, image: '' })}
                    >
                      <Ionicons name="close-circle" size={24} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <Text style={styles.orDivider}>- או הדבק URL -</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>קישור לתמונה</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.image}
                    onChangeText={(text) => setFormData({ ...formData, image: text })}
                    placeholder="https://example.com/image.jpg"
                    textAlign="right"
                    placeholderTextColor="#999"
                    ref={imageInputRef}
                    onFocus={() => setCurrentField('image')}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                  <Text style={styles.inputHint}>השאר ריק אם אין תמונה</Text>
                </View>
              </View>
            </ScrollView>

            {/* Navigation Buttons - Always visible */}
            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={focusPreviousField}
                disabled={currentField === 'name'}
              >
                <Ionicons name="chevron-up" size={20} color={currentField === 'name' ? '#ccc' : '#007bff'} />
                <Text style={[styles.navButtonText, { color: currentField === 'name' ? '#ccc' : '#007bff' }]}>קודם</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.navButton}
                onPress={focusNextField}
              >
                <Text style={styles.navButtonText}>הבא</Text>
                <Ionicons name="chevron-down" size={20} color="#007bff" />
              </TouchableOpacity>
            </View>

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
                <Text style={styles.saveButtonText}>שמור טיפול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  treatmentsList: {
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
  treatmentCard: {
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
  treatmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  treatmentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    textAlign: 'right',
  },
  treatmentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E8D5C4',
  },
  treatmentImageContainer: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  treatmentImage: {
    width: '100%',
    height: '100%',
  },
  treatmentDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  treatmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  modalBody: {
    flex: 1,
    marginBottom: 20,
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
    marginBottom: 8,
    minHeight: 48,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    minHeight: 100,
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
  imagePreviewContainer: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeImageText: {
    fontSize: 12,
    color: '#007bff',
  },
  uploadImageButton: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadImageText: {
    fontSize: 14,
    color: '#007bff',
    textDecorationLine: 'underline',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  debugInfo: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#333',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
    textAlign: 'right',
  },
  inputGroup: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007bff',
  },
  navButtonText: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: 'bold',
  },
  uploadImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
    borderWidth: 2,
    borderColor: '#007bff',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  uploadImageText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 16,
  },
  imagePreview: {
    width: 200,
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  orDivider: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginVertical: 12,
  },
});

export default AdminTreatmentsScreen;
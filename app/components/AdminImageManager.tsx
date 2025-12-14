import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    addAppGalleryImage,
    AppImages,
    getAppImages,
    removeAppGalleryImage,
    replaceAppGalleryImage,
    updateAboutUsImage,
    updateAtmosphereImage
} from '../../services/firebase';
import ConfirmationModal from './ConfirmationModal';

const { width } = Dimensions.get('window');

interface AdminImageManagerProps {
  onClose: () => void;
}

const AdminImageManager: React.FC<AdminImageManagerProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [images, setImages] = useState<AppImages>({
    atmosphereImage: '',
    aboutUsImage: '',
    galleryImages: []
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = useCallback(async () => {
    try {
      const appImages = await getAppImages();
      setImages(appImages);
    } catch (error) {
      console.error('Error loading images:', error);
      Alert.alert(t('common.error'), 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, [t]);

  const pickImage = async () => {
    try {
      console.log('📱 Requesting media library permissions...');
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(t('common.error'), 'נדרשת הרשאה לגישה לגלריה');
        return null;
      }

      // Double check permission status
      if (permissionResult.status !== 'granted') {
        Alert.alert(t('common.error'), 'הרשאת גישה נדחתה');
        return null;
      }

      console.log('📱 Permissions granted, launching image picker...');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      console.log('📱 Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('📤 Selected image URI:', imageUri);
        
        if (!imageUri) {
          Alert.alert(t('common.error'), 'שגיאה בבחירת התמונה');
          return null;
        }
        
        return imageUri;
      } else {
        console.log('📱 Image selection canceled or no assets');
        return null;
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert(t('common.error'), `שגיאה בבחירת התמונה: ${(error as Error).message || 'Unknown error'}`);
      return null;
    }
  };

  const handleUpdateAtmosphere = async () => {
    try {
      const imageUri = await pickImage();
      if (!imageUri) return;

      setUploading(true);
      console.log('📤 Uploading atmosphere image...');
      await updateAtmosphereImage(imageUri);
      await loadImages();
      setSuccessMessage(t('admin.atmosphere_updated'));
      setShowSuccessModal(true);
      console.log('✅ Atmosphere image updated successfully');
    } catch (error) {
      console.error('❌ Error updating atmosphere image:', error);
      Alert.alert(t('common.error'), `שגיאה בעדכון תמונת האווירה: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateAboutUs = async () => {
    try {
      const imageUri = await pickImage();
      if (!imageUri) return;

      setUploading(true);
      console.log('📤 Uploading about us image...');
      await updateAboutUsImage(imageUri);
      await loadImages();
      setSuccessMessage(t('admin.about_us_updated'));
      setShowSuccessModal(true);
      console.log('✅ About us image updated successfully');
    } catch (error) {
      console.error('❌ Error updating about us image:', error);
      Alert.alert(t('common.error'), `שגיאה בעדכון תמונת אודותינו: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAddGalleryImage = async () => {
    try {
      const imageUri = await pickImage();
      if (!imageUri) return;

      setUploading(true);
      console.log('📤 Adding gallery image...');
      await addAppGalleryImage(imageUri);
      await loadImages();
      setSuccessMessage(t('admin.gallery_image_added'));
      setShowSuccessModal(true);
      console.log('✅ Gallery image added successfully');
    } catch (error) {
      console.error('❌ Error adding gallery image:', error);
      Alert.alert(t('common.error'), `שגיאה בהוספת תמונה לגלריה: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveGalleryImage = (imageUrl: string) => {
    setConfirmMessage(t('admin.confirm_remove_image'));
    setConfirmAction(() => async () => {
      try {
        setUploading(true);
        await removeAppGalleryImage(imageUrl);
        await loadImages();
        setSuccessMessage(t('admin.gallery_image_removed'));
        setShowSuccessModal(true);
      } catch (error) {
        console.error('Error removing gallery image:', error);
        Alert.alert(t('common.error'), 'Failed to remove gallery image');
      } finally {
        setUploading(false);
      }
    });
    setShowConfirmModal(true);
  };

  const handleReplaceGalleryImage = async (oldImageUrl: string) => {
    try {
      const imageUri = await pickImage();
      if (!imageUri) return;

      setUploading(true);
      console.log('📤 Replacing gallery image...');
      await replaceAppGalleryImage(oldImageUrl, imageUri);
      await loadImages();
      setSuccessMessage(t('admin.gallery_image_replaced'));
      setShowSuccessModal(true);
      console.log('✅ Gallery image replaced successfully');
    } catch (error) {
      console.error('❌ Error replacing gallery image:', error);
      Alert.alert(t('common.error'), `שגיאה בהחלפת תמונה בגלריה: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.image_management')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Atmosphere Image Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.atmosphere_image')}</Text>
          <View style={styles.imageContainer}>
            {images.atmosphereImage ? (
              <Image
                source={{ uri: images.atmosphereImage }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.previewImage, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={48} color="#666" />
                <Text style={{ color: '#666', marginTop: 8 }}>אין תמונת אווירה</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdateAtmosphere}
              disabled={uploading}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.updateButtonText}>{t('admin.update_image')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About Us Image Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.about_us_image')}</Text>
          <View style={styles.imageContainer}>
            {images.aboutUsImage ? (
              <Image
                source={{ uri: images.aboutUsImage }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.previewImage, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={48} color="#666" />
                <Text style={{ color: '#666', marginTop: 8 }}>אין תמונת אודותינו</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdateAboutUs}
              disabled={uploading}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.updateButtonText}>{t('admin.update_image')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gallery Images Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.gallery_images')}</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddGalleryImage}
              disabled={uploading}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>{t('admin.add_image')}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.galleryGrid}>
            {images.galleryImages && images.galleryImages.length > 0 ? (
              images.galleryImages.map((imageUrl, index) => (
                <View key={index} style={styles.galleryImageContainer}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                  <View style={styles.galleryImageActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.replaceButton]}
                      onPress={() => handleReplaceGalleryImage(imageUrl)}
                      disabled={uploading}
                    >
                      <Ionicons name="swap-horizontal" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.removeButton]}
                      onPress={() => handleRemoveGalleryImage(imageUrl)}
                      disabled={uploading}
                    >
                      <Ionicons name="trash" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyGallery}>
                <Ionicons name="images-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>{t('admin.no_gallery_images')}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingContent}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.uploadingText}>{t('admin.uploading')}</Text>
          </View>
        </View>
      )}

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={t('common.success')}
        message={successMessage}
        type="success"
      />

      {/* Confirm Modal */}
      <ConfirmationModal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title={t('common.confirm')}
        message={confirmMessage}
        type="warning"
        confirmText={t('common.yes')}
        cancelText={t('common.no')}
        onConfirm={confirmAction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  imageContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: width - 80,
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  galleryImageContainer: {
    width: (width - 100) / 2,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#444',
  },
  galleryImage: {
    width: '100%',
    height: 120,
  },
  galleryImageActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 6,
  },
  replaceButton: {
    backgroundColor: '#8B4513',
  },
  removeButton: {
    backgroundColor: '#dc3545',
  },
  emptyGallery: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingContent: {
    backgroundColor: '#333',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
});

export default AdminImageManager;
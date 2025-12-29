import { Image, ImageContentFit, ImageProps } from 'expo-image';
import React, { memo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OptimizedImageProps {
  source: string | { uri: string } | number;
  style?: ViewStyle | ViewStyle[];
  resizeMode?: ImageContentFit;
  priority?: 'low' | 'normal' | 'high';
  placeholder?: string | number;
  onLoad?: () => void;
  onError?: (error: any) => void;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
}

/**
 * Optimized Image Component using expo-image for better performance
 * Features:
 * - Automatic caching (disk + memory)
 * - Progressive loading
 * - WebP support
 * - Better performance on iOS and Android
 */
const OptimizedImage = memo<OptimizedImageProps>(({
  source,
  style,
  resizeMode = 'cover',
  priority = 'normal',
  placeholder,
  onLoad,
  onError,
  cachePolicy = 'memory-disk',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Normalize source to expo-image format
  const imageSource = typeof source === 'string' 
    ? { uri: source } 
    : typeof source === 'object' && 'uri' in source
    ? source
    : source;

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = (error: any) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(error);
  };

  // Error state
  if (hasError) {
    return (
      <View style={[style, styles.errorContainer]}>
        <Ionicons name="image-outline" size={32} color="#ccc" />
        <Text style={styles.errorText}>תמונה לא זמינה</Text>
      </View>
    );
  }

  // Loading state with placeholder
  if (isLoading && placeholder) {
    return (
      <View style={[style, styles.container]}>
        <Image
          source={placeholder}
          style={[StyleSheet.absoluteFill, style]}
          contentFit={resizeMode}
          cachePolicy={cachePolicy}
        />
        <Image
          source={imageSource}
          style={[StyleSheet.absoluteFill, style]}
          contentFit={resizeMode}
          priority={priority}
          cachePolicy={cachePolicy}
          onLoad={handleLoad}
          onError={handleError}
          transition={200}
        />
      </View>
    );
  }

  return (
    <View style={[style, styles.container]}>
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
      <Image
        source={imageSource}
        style={[StyleSheet.absoluteFill, style]}
        contentFit={resizeMode}
        priority={priority}
        cachePolicy={cachePolicy}
        onLoad={handleLoad}
        onError={handleError}
        transition={200}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if source URI changes
  const prevUri = typeof prevProps.source === 'string' 
    ? prevProps.source 
    : typeof prevProps.source === 'object' && 'uri' in prevProps.source
    ? prevProps.source.uri
    : prevProps.source;
  
  const nextUri = typeof nextProps.source === 'string'
    ? nextProps.source
    : typeof nextProps.source === 'object' && 'uri' in nextProps.source
    ? nextProps.source.uri
    : nextProps.source;

  return prevUri === nextUri && 
         prevProps.priority === nextProps.priority &&
         prevProps.resizeMode === nextProps.resizeMode;
});

OptimizedImage.displayName = 'OptimizedImage';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  errorContainer: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  loadingContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OptimizedImage;


import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors } from '../constants/colors';

type NotificationToastType = 'info' | 'success' | 'warning' | 'error' | 'broadcast';

interface NotificationToastPayload {
  id?: string;
  title: string;
  message: string;
  type?: NotificationToastType;
  durationMs?: number;
  dedupeKey?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationToastContextValue {
  showNotificationToast: (payload: NotificationToastPayload) => void;
  hideNotificationToast: () => void;
}

const NotificationToastContext = createContext<NotificationToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4500;
const DEDUPE_WINDOW_MS = 8000;

const getToastGradient = (type: NotificationToastType) => {
  switch (type) {
    case 'success':
      return [colors.success, '#0e8f64'];
    case 'warning':
      return [colors.warning, '#b56b07'];
    case 'error':
      return [colors.error, '#b91c1c'];
    case 'broadcast':
      return [colors.barberGoldLight, colors.barberGold, colors.barberGoldDark];
    case 'info':
    default:
      return [colors.barberGoldLight, colors.barberGold, colors.barberGoldDark];
  }
};

const getToastIcon = (type: NotificationToastType) => {
  switch (type) {
    case 'success':
      return 'checkmark-circle';
    case 'warning':
      return 'alert-circle';
    case 'error':
      return 'close-circle';
    case 'broadcast':
      return 'megaphone';
    case 'info':
    default:
      return 'notifications';
  }
};

const NotificationToast: React.FC<{
  visible: boolean;
  title: string;
  message: string;
  type: NotificationToastType;
  actionLabel?: string;
  onClose: () => void;
  onAction?: () => void;
}> = ({ visible, title, message, type, actionLabel, onClose, onAction }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const centerOffset = useRef(new Animated.Value(-80)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (shouldRender) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -16,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setShouldRender(false));
    }
  }, [opacity, shouldRender, translateY, visible]);

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          top: '50%',
          opacity,
          transform: [{ translateY: Animated.add(translateY, centerOffset) }],
        },
      ]}
    >
      <LinearGradient
        colors={getToastGradient(type)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toastGradient}
      >
        <View style={styles.accentBar} />
        <View style={styles.toastHeader}>
          <View style={styles.iconWrap}>
            <Ionicons name={getToastIcon(type)} size={20} color={colors.text} />
          </View>
          <Text style={styles.toastTitle} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.toastMessage} numberOfLines={3}>
          {message}
        </Text>

        <TouchableOpacity onPress={onClose} style={styles.primaryCloseButton}>
          <Text style={styles.primaryCloseText}>סגור</Text>
        </TouchableOpacity>

        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} style={styles.actionButton}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

export const NotificationToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toast, setToast] = useState<NotificationToastPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToastKeyRef = useRef<string | null>(null);
  const lastToastAtRef = useRef(0);

  const hideNotificationToast = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setVisible(false);
  }, []);

  const showNotificationToast = useCallback((payload: NotificationToastPayload) => {
    const dedupeKey = payload.dedupeKey || `${payload.title}|${payload.message}`;
    const now = Date.now();
    if (lastToastKeyRef.current === dedupeKey && now - lastToastAtRef.current < DEDUPE_WINDOW_MS) {
      return;
    }

    lastToastKeyRef.current = dedupeKey;
    lastToastAtRef.current = now;

    setToast(payload);
    setVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    const duration = payload.durationMs ?? DEFAULT_DURATION_MS;
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({ showNotificationToast, hideNotificationToast }),
    [hideNotificationToast, showNotificationToast]
  );

  return (
    <NotificationToastContext.Provider value={value}>
      {children}
      {toast && (
        <NotificationToast
          visible={visible}
          title={toast.title}
          message={toast.message}
          type={toast.type || 'info'}
          actionLabel={toast.actionLabel}
          onClose={hideNotificationToast}
          onAction={() => {
            toast.onAction?.();
            hideNotificationToast();
          }}
        />
      )}
    </NotificationToastContext.Provider>
  );
};

export const useNotificationToast = () => {
  const context = useContext(NotificationToastContext);
  if (!context) {
    throw new Error('useNotificationToast must be used within NotificationToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  toastGradient: {
    borderRadius: 16,
    padding: 18,
  },
  accentBar: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
  toastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  toastTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  toastMessage: {
    marginTop: 8,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryCloseButton: {
    marginTop: 16,
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    top: -2,
    padding: 4,
  },
  actionButton: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  actionText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
});

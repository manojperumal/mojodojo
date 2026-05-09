import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_PREF_KEY = 'olive_notif_pref';

interface NotificationModalProps {
  visible: boolean;
  recipientName?: string;
  onClose: () => void;
}

export default function NotificationModal({
  visible,
  recipientName,
  onClose,
}: NotificationModalProps): React.ReactElement {
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      await AsyncStorage.setItem(NOTIF_PREF_KEY, status);

      if (status === 'granted') {
        await Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
      }
    } catch {
      // Permission request failed silently
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleDismiss = async () => {
    await AsyncStorage.setItem(NOTIF_PREF_KEY, 'dismissed');
    onClose();
  };

  const nameDisplay = recipientName ? recipientName : 'they';

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleDismiss}
      onBackButtonPress={handleDismiss}
      backdropOpacity={0.4}
      backdropColor="#1A1A1A"
      animationIn="slideInUp"
      animationOut="slideOutDown"
      style={styles.modal}
      useNativeDriver
    >
      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Bell icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔔</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          Know when {nameDisplay === 'they' ? 'they open' : `${nameDisplay} opens`} it?
        </Text>

        {/* Body */}
        <Text style={styles.body}>
          Get a quiet notification the moment {nameDisplay === 'they' ? 'they' : nameDisplay}{' '}
          opens your card. No spam — just the moment that matters.
        </Text>

        {/* Enable button */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonLoading]}
          onPress={handleEnable}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Enable notifications</Text>
          )}
        </TouchableOpacity>

        {/* Dismiss */}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissButtonText}>Not right now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  sheet: {
    backgroundColor: '#FBF8F3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8E3DB',
    marginBottom: 24,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF3D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 22,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 30,
  },
  body: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#6B6459',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  primaryButton: {
    backgroundColor: '#C75A3F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonLoading: {
    opacity: 0.8,
  },
  primaryButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dismissButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#6B6459',
  },
});

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useGiftStore } from '../store/gift';
import CardPreview from '../components/CardPreview';
import NotificationModal from '../components/NotificationModal';

type ConfirmationNavigationProp = StackNavigationProp<RootStackParamList, 'Confirmation'>;

interface ConfirmationScreenProps {
  navigation: ConfirmationNavigationProp;
}

const FIRST_SEND_KEY = 'olive_first_send';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ConfirmationScreen({ navigation }: ConfirmationScreenProps): React.ReactElement {
  const draft = useGiftStore((s) => s.draft);
  const createdGiftId = useGiftStore((s) => s.createdGiftId);
  const resetDraft = useGiftStore((s) => s.resetDraft);

  const [showNotifModal, setShowNotifModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const checkFirstSend = async () => {
      const hasSeenNotifModal = await AsyncStorage.getItem(FIRST_SEND_KEY);
      if (!hasSeenNotifModal) {
        setTimeout(() => {
          setShowNotifModal(true);
        }, 1000);
      }
    };

    checkFirstSend();
  }, []);

  const handleNotifModalClose = async () => {
    setShowNotifModal(false);
    await AsyncStorage.setItem(FIRST_SEND_KEY, 'true');
  };

  const handleSendAnother = () => {
    resetDraft();
    navigation.navigate('Home');
  };

  const handleViewGift = () => {
    if (createdGiftId) {
      navigation.navigate('GiftDetail', { giftId: createdGiftId });
    } else {
      navigation.navigate('Home');
    }
  };

  const deliverySummary = (): string => {
    if (draft.deliveryMethod === 'sms') return `SMS to ${draft.recipientPhone}`;
    if (draft.deliveryMethod === 'email') return `Email to ${draft.recipientEmail}`;
    return 'Ready for sharing';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Sent mark */}
        <Text style={styles.sentMark}>✦ Sent.</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {draft.recipientName
            ? `${draft.recipientName}'s gift is on its way.`
            : 'Your gift is on its way.'}
        </Text>
        <Text style={styles.deliverySummary}>{deliverySummary()}</Text>

        {/* Mini card preview */}
        <View style={styles.cardContainer}>
          <CardPreview
            cardDesign={draft.cardDesign}
            occasion={draft.occasion}
            brandLogoUrl={draft.brand?.logoUrl}
            brandName={draft.brand?.name}
            message={draft.message || undefined}
            recipientName={draft.recipientName || undefined}
            style={styles.card}
          />
        </View>

        {/* Amount badge */}
        <View style={styles.amountBadge}>
          <Text style={styles.amountBadgeText}>
            ${draft.amount ?? 0} {draft.brand?.name ?? ''} Gift Card
          </Text>
        </View>

        {/* Links */}
        <View style={styles.linksContainer}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleViewGift}
            activeOpacity={0.7}
          >
            <Text style={styles.linkButtonText}>Track your gift →</Text>
          </TouchableOpacity>

          <View style={styles.linkDivider} />

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleSendAnother}
            activeOpacity={0.7}
          >
            <Text style={styles.linkButtonText}>Send another gift →</Text>
          </TouchableOpacity>

          <View style={styles.linkDivider} />

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.7}
          >
            <Text style={[styles.linkButtonText, styles.linkButtonMuted]}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <NotificationModal
        visible={showNotifModal}
        recipientName={draft.recipientName || undefined}
        onClose={handleNotifModalClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sentMark: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 52,
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 20,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 28,
  },
  deliverySummary: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#6B6459',
    marginBottom: 32,
    textAlign: 'center',
  },
  cardContainer: {
    width: SCREEN_WIDTH * 0.7,
    marginBottom: 16,
  },
  card: {
    width: '100%',
  },
  amountBadge: {
    backgroundColor: '#F0EDE8',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 40,
  },
  amountBadgeText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 13,
    color: '#6B6459',
    fontWeight: '500',
  },
  linksContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    overflow: 'hidden',
  },
  linkButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  linkButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#C75A3F',
    fontWeight: '600',
    textAlign: 'center',
  },
  linkButtonMuted: {
    color: '#6B6459',
    fontWeight: '400',
  },
  linkDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E3DB',
    marginHorizontal: 16,
  },
});

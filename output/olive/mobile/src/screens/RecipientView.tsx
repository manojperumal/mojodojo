import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Modal from 'react-native-modal';
import { RootStackParamList, Gift } from '../types';
import { getRecipientGift, openGift, redeemGift, sendThankYou } from '../api/client';
import CardPreview from '../components/CardPreview';

type RecipientViewNavigationProp = StackNavigationProp<RootStackParamList, 'RecipientView'>;
type RecipientViewRouteProp = RouteProp<RootStackParamList, 'RecipientView'>;

interface RecipientViewProps {
  navigation: RecipientViewNavigationProp;
  route: RecipientViewRouteProp;
}

type ViewState = 'LOADING' | 'ENVELOPE' | 'OPEN_ANIMATION' | 'CARD' | 'REVEALED';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function RecipientView({ route }: RecipientViewProps): React.ReactElement {
  const { giftId, token } = route.params;

  const [viewState, setViewState] = useState<ViewState>('LOADING');
  const [gift, setGift] = useState<Gift | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Revealed state
  const [giftCode, setGiftCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  // Thank you modal
  const [thankYouVisible, setThankYouVisible] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [sendingThankYou, setSendingThankYou] = useState(false);

  // Animations
  const envelopeScaleAnim = useRef(new Animated.Value(1)).current;
  const envelopePulseAnim = useRef(new Animated.Value(1)).current;
  const envelopeFadeAnim = useRef(new Animated.Value(1)).current;
  const cardEntranceAnim = useRef(new Animated.Value(0)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation loop for "Tap to open"
  useEffect(() => {
    if (viewState !== 'ENVELOPE') return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(envelopePulseAnim, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(envelopePulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [viewState]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getRecipientGift(giftId, token);
        setGift(data);
        if (data.status === 'redeemed' && data.giftCode) {
          setGiftCode(data.giftCode);
          setViewState('REVEALED');
        } else if (data.status === 'opened') {
          setViewState('CARD');
        } else {
          setViewState('ENVELOPE');
        }
      } catch {
        setLoadError('Could not load gift. Please check the link and try again.');
        setViewState('ENVELOPE');
      }
    };
    load();
  }, [giftId, token]);

  const runOpenAnimation = useCallback(async () => {
    if (viewState !== 'ENVELOPE' || !gift) return;
    setViewState('OPEN_ANIMATION');

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Call openGift API
    try {
      await openGift(giftId, token);
    } catch {
      // Proceed with animation regardless
    }

    Animated.sequence([
      // Envelope scale up and fade out
      Animated.parallel([
        Animated.timing(envelopeScaleAnim, {
          toValue: 1.15,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(envelopeFadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    ]).start(async () => {
      setViewState('CARD');

      Animated.parallel([
        Animated.spring(cardEntranceAnim, {
          toValue: 1,
          tension: 55,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
    });
  }, [viewState, gift, giftId, token]);

  const handleReveal = async () => {
    if (!gift || redeeming) return;
    setRedeeming(true);
    try {
      const result = await redeemGift(giftId, token);
      setGiftCode(result.giftCode);
      setViewState('REVEALED');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not reveal gift code. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleCopyCode = async () => {
    if (!giftCode) return;
    await Clipboard.setStringAsync(giftCode);
    setCodeCopied(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  const handleSendThankYou = async () => {
    if (!thankYouMessage.trim()) return;
    setSendingThankYou(true);
    try {
      await sendThankYou(giftId, thankYouMessage.trim(), token);
      setThankYouVisible(false);
      setThankYouMessage('');
      Alert.alert('Sent!', 'Your thank you note has been delivered.');
    } catch {
      Alert.alert('Error', 'Could not send. Please try again.');
    } finally {
      setSendingThankYou(false);
    }
  };

  const cardTranslateY = cardEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.3, 0],
  });

  if (viewState === 'LOADING') {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#C75A3F" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorTitle}>Hmm.</Text>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  const brandAccentColor = gift?.brand?.accentColor ?? '#C75A3F';
  const recipientName = gift?.recipientName ?? 'You';

  // ENVELOPE state
  if (viewState === 'ENVELOPE' || viewState === 'OPEN_ANIMATION') {
    return (
      <SafeAreaView style={[styles.envelopeScreen, { backgroundColor: brandAccentColor }]}>
        <Animated.View
          style={[
            styles.envelopeContent,
            {
              opacity: envelopeFadeAnim,
              transform: [{ scale: envelopeScaleAnim }],
            },
          ]}
        >
          {/* Sender info */}
          <Text style={styles.envelopeSenderLabel}>A gift from</Text>
          <Text style={styles.envelopeSenderName}>
            {gift?.signature?.split(':')[1] ?? 'A friend'}
          </Text>

          {/* Envelope graphic */}
          <View style={styles.envelopeIconContainer}>
            <Text style={styles.envelopeEmoji}>✉️</Text>
          </View>

          {/* Recipient */}
          <Text style={styles.envelopeForText}>For</Text>
          <Text style={styles.envelopeRecipientName}>{recipientName}</Text>

          {/* Tap to open */}
          <Pressable
            onPress={runOpenAnimation}
            disabled={viewState === 'OPEN_ANIMATION'}
            style={styles.tapContainer}
          >
            <Animated.Text
              style={[
                styles.tapToOpenText,
                { transform: [{ scale: envelopePulseAnim }] },
              ]}
            >
              {viewState === 'OPEN_ANIMATION' ? 'Opening...' : 'Tap to open'}
            </Animated.Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // CARD state
  if (viewState === 'CARD') {
    return (
      <SafeAreaView style={styles.cardScreen}>
        <Animated.ScrollView
          contentContainerStyle={styles.cardScrollContent}
          style={{
            opacity: cardOpacityAnim,
            transform: [{ translateY: cardTranslateY }],
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Occasion label */}
          <Text style={styles.cardOccasionLabel}>
            {gift?.occasion?.replace('-', ' ') ?? ''}
          </Text>

          {/* Card */}
          <View style={styles.fullCardContainer}>
            <CardPreview
              cardDesign={gift?.cardDesign ?? null}
              occasion={gift?.occasion ?? null}
              brandLogoUrl={gift?.brand?.logoUrl}
              brandName={gift?.brand?.name}
              message={gift?.message}
              signature={gift?.signature}
              recipientName={gift?.recipientName}
            />
          </View>

          {/* Message */}
          {gift?.message ? (
            <View style={styles.messageSection}>
              <Text style={styles.messageSectionText}>{gift.message}</Text>
            </View>
          ) : null}

          {/* Signature */}
          {gift?.signature ? (
            <Text style={styles.signatureText}>
              — {gift.signature.includes(':') ? gift.signature.split(':')[1] : gift.signature}
            </Text>
          ) : null}

          {/* Reveal button */}
          <TouchableOpacity
            style={[styles.revealButton, redeeming && styles.revealButtonLoading]}
            onPress={handleReveal}
            disabled={redeeming}
            activeOpacity={0.85}
          >
            {redeeming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.revealButtonText}>Reveal gift →</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.revealHint}>
            Your {gift?.brand?.name ?? 'gift'} gift card code will be shown.
          </Text>
        </Animated.ScrollView>
      </SafeAreaView>
    );
  }

  // REVEALED state
  return (
    <SafeAreaView style={styles.cardScreen}>
      <ScrollView
        contentContainerStyle={styles.revealedScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success */}
        <Text style={styles.revealedTitle}>Here's your gift 🎁</Text>
        <Text style={styles.revealedSubtitle}>
          ${gift?.amount ?? 0} {gift?.brand?.name ?? ''} Gift Card
        </Text>

        {/* Gift code box */}
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Gift Card Code</Text>
          <Text style={styles.codeValue} selectable>
            {giftCode ?? '—'}
          </Text>
          <TouchableOpacity
            style={[styles.copyButton, codeCopied && styles.copyButtonCopied]}
            onPress={handleCopyCode}
            activeOpacity={0.7}
          >
            <Text style={[styles.copyButtonText, codeCopied && styles.copyButtonTextCopied]}>
              {codeCopied ? '✓ Copied!' : 'Copy code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Redeem button */}
        {gift?.brand?.name && (
          <TouchableOpacity
            style={styles.redeemButton}
            onPress={() => {
              Alert.alert(
                'Redeem at ' + gift.brand.name,
                'Visit the ' + gift.brand.name + ' app or website and enter the code at checkout.',
                [{ text: 'Got it' }],
              );
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.redeemButtonText}>
              Redeem at {gift.brand.name}
            </Text>
          </TouchableOpacity>
        )}

        {/* Card mini preview */}
        <View style={styles.miniCardContainer}>
          <CardPreview
            cardDesign={gift?.cardDesign ?? null}
            occasion={gift?.occasion ?? null}
            brandLogoUrl={gift?.brand?.logoUrl}
            brandName={gift?.brand?.name}
            message={gift?.message}
            recipientName={gift?.recipientName}
          />
        </View>

        {/* Send thank you */}
        <TouchableOpacity
          style={styles.thankYouLink}
          onPress={() => setThankYouVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.thankYouLinkText}>Send a thank you ✦</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Thank you modal */}
      <Modal
        isVisible={thankYouVisible}
        onBackdropPress={() => setThankYouVisible(false)}
        onBackButtonPress={() => setThankYouVisible(false)}
        backdropOpacity={0.4}
        backdropColor="#1A1A1A"
        animationIn="slideInUp"
        animationOut="slideOutDown"
        style={styles.thankYouModal}
        useNativeDriver
      >
        <View style={styles.thankYouSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.thankYouTitle}>Send a thank you</Text>
          <Text style={styles.thankYouBody}>
            {gift
              ? `Let ${gift.signature?.includes(':') ? gift.signature.split(':')[1] : 'them'} know you appreciated the gift.`
              : 'Share your appreciation.'}
          </Text>
          <TextInput
            style={styles.thankYouInput}
            value={thankYouMessage}
            onChangeText={setThankYouMessage}
            placeholder="Thank you so much for the gift! 🙏"
            placeholderTextColor="#6B6459"
            multiline
            maxLength={300}
            textAlignVertical="top"
            autoFocus
          />
          <TouchableOpacity
            style={[
              styles.thankYouSendButton,
              (!thankYouMessage.trim() || sendingThankYou) && styles.thankYouSendButtonDisabled,
            ]}
            onPress={handleSendThankYou}
            disabled={!thankYouMessage.trim() || sendingThankYou}
            activeOpacity={0.8}
          >
            {sendingThankYou ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.thankYouSendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.thankYouCancelButton}
            onPress={() => setThankYouVisible(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.thankYouCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF8F3',
    gap: 16,
    padding: 24,
  },
  errorTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 28,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  errorText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#6B6459',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Envelope
  envelopeScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelopeContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  envelopeSenderLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  envelopeSenderName: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 26,
    color: '#FFFFFF',
    marginBottom: 36,
  },
  envelopeIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  envelopeEmoji: {
    fontSize: 52,
  },
  envelopeForText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  envelopeRecipientName: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 48,
  },
  tapContainer: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tapToOpenText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
  },

  // Card
  cardScreen: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  cardScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 60,
    alignItems: 'center',
  },
  cardOccasionLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 12,
    color: '#6B6459',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  fullCardContainer: {
    width: '100%',
    marginBottom: 24,
  },
  messageSection: {
    width: '100%',
    marginBottom: 12,
  },
  messageSectionText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 17,
    color: '#1A1A1A',
    lineHeight: 26,
    textAlign: 'center',
  },
  signatureText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#6B6459',
    fontStyle: 'italic',
    marginBottom: 36,
  },
  revealButton: {
    backgroundColor: '#C75A3F',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  revealButtonLoading: {
    opacity: 0.7,
  },
  revealButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  revealHint: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 12,
    color: '#6B6459',
    textAlign: 'center',
  },

  // Revealed
  revealedScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 60,
    alignItems: 'center',
  },
  revealedTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 28,
    color: '#1A1A1A',
    marginBottom: 6,
    textAlign: 'center',
  },
  revealedSubtitle: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 16,
    color: '#6B6459',
    marginBottom: 28,
    textAlign: 'center',
  },
  codeBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8E3DB',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  codeLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 11,
    color: '#6B6459',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  codeValue: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 22,
    color: '#1A1A1A',
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  copyButton: {
    borderWidth: 1.5,
    borderColor: '#C75A3F',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  copyButtonCopied: {
    backgroundColor: '#C75A3F',
    borderColor: '#C75A3F',
  },
  copyButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    fontWeight: '600',
    color: '#C75A3F',
  },
  copyButtonTextCopied: {
    color: '#FFFFFF',
  },
  redeemButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  redeemButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  miniCardContainer: {
    width: SCREEN_WIDTH * 0.65,
    marginBottom: 24,
  },
  thankYouLink: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  thankYouLinkText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 16,
    color: '#C75A3F',
    fontStyle: 'italic',
  },

  // Thank you modal
  thankYouModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  thankYouSheet: {
    backgroundColor: '#FBF8F3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8E3DB',
    alignSelf: 'center',
    marginBottom: 24,
  },
  thankYouTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 22,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  thankYouBody: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#6B6459',
    lineHeight: 20,
    marginBottom: 16,
  },
  thankYouInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    color: '#1A1A1A',
    minHeight: 110,
    marginBottom: 16,
  },
  thankYouSendButton: {
    backgroundColor: '#C75A3F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  thankYouSendButtonDisabled: {
    backgroundColor: '#E8E3DB',
  },
  thankYouSendButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  thankYouCancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  thankYouCancelButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#6B6459',
  },
});

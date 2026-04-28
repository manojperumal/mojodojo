import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../types';
import { useGiftStore } from '../store/gift';
import CardPreview from '../components/CardPreview';

type PreviewNavigationProp = StackNavigationProp<RootStackParamList, 'Preview'>;

interface PreviewScreenProps {
  navigation: PreviewNavigationProp;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 24;

type AnimationState = 'idle' | 'opening' | 'opened';

export default function PreviewScreen({ navigation }: PreviewScreenProps): React.ReactElement {
  const draft = useGiftStore((s) => s.draft);

  const [animationState, setAnimationState] = useState<AnimationState>('idle');

  const envelopeFlapAnim = useRef(new Animated.Value(0)).current;
  const cardSlideAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacityAnim = useRef(new Animated.Value(1)).current;

  const recipientContact =
    draft.deliveryMethod === 'sms'
      ? draft.recipientPhone
      : draft.deliveryMethod === 'email'
      ? draft.recipientEmail
      : 'via link';

  const previewUrl = `https://pensivepost.app/g/preview`;

  const getSignatureDisplay = (): string => {
    if (draft.signatureMode === 'style') {
      return 'Your signature';
    }
    if (draft.signatureMode === 'initials') {
      const [initials] = (draft.signatureInitials || 'PP').split(':');
      return initials;
    }
    return '[Handwritten]';
  };

  const handleCardTap = async () => {
    if (animationState !== 'idle') return;

    setAnimationState('opening');

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      // Fade out overlay
      Animated.timing(overlayOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      // Flap rotate (simulated via scale Y)
      Animated.timing(envelopeFlapAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Card slides up
      Animated.spring(cardSlideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
    ]).start(async () => {
      setAnimationState('opened');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const handleReset = () => {
    setAnimationState('idle');
    envelopeFlapAnim.setValue(0);
    cardSlideAnim.setValue(0);
    overlayOpacityAnim.setValue(1);
  };

  const flapRotation = envelopeFlapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-180deg'],
  });

  const cardTranslateY = cardSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  const cardOpacity = cardSlideAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.6, 1],
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SMS Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SMS Preview</Text>
          <View style={styles.messageBubbleContainer}>
            <View style={styles.messageBubble}>
              <Text style={styles.messageBubbleText}>
                {draft.recipientName
                  ? `Hey ${draft.recipientName}, `
                  : ''}
                You have a gift from Pensive Post! 🎁{'\n\n'}
                {previewUrl}
              </Text>
            </View>
            <View style={styles.messageMeta}>
              <Text style={styles.messageMetaText}>
                {draft.deliveryMethod === 'sms' ? '💬 SMS' : draft.deliveryMethod === 'email' ? '✉️ Email' : '🔗 Link'}
                {recipientContact && recipientContact !== 'via link' ? ` → ${recipientContact}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Interactive card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {animationState === 'opened' ? 'Card Preview' : 'Interactive Preview'}
          </Text>

          <Pressable
            style={styles.cardWrapper}
            onPress={animationState === 'idle' ? handleCardTap : undefined}
          >
            <Animated.View
              style={[
                styles.cardAnimWrapper,
                {
                  opacity: cardOpacity,
                  transform: [{ translateY: cardTranslateY }],
                },
              ]}
            >
              <CardPreview
                cardDesign={draft.cardDesign}
                occasion={draft.occasion}
                brandLogoUrl={draft.brand?.logoUrl}
                brandName={draft.brand?.name}
                message={draft.message || undefined}
                signature={getSignatureDisplay()}
                recipientName={draft.recipientName || undefined}
              />
            </Animated.View>

            {/* Tap to open overlay */}
            {animationState === 'idle' && (
              <Animated.View
                style={[styles.tapOverlay, { opacity: overlayOpacityAnim }]}
                pointerEvents="none"
              >
                <Animated.View
                  style={[
                    styles.envelopeFlap,
                    { transform: [{ rotateX: flapRotation }] },
                  ]}
                />
                <Text style={styles.tapOverlayText}>Tap to open</Text>
              </Animated.View>
            )}
          </Pressable>

          {animationState === 'opened' && (
            <TouchableOpacity style={styles.replayLink} onPress={handleReset}>
              <Text style={styles.replayLinkText}>↺ Replay animation</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Summary chip */}
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillText}>
            ${draft.amount ?? 0} {draft.brand?.name ?? ''} gift card
            {draft.sendNow ? ' · Sending now' : ' · Scheduled'}
          </Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.editLink}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.editLinkText}>← Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('Review')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>Review & Pay →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 28,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#1A1A1A',
    marginBottom: 14,
  },
  messageBubbleContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    backgroundColor: '#C75A3F',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  messageBubbleText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  messageMeta: {
    marginTop: 6,
  },
  messageMetaText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 11,
    color: '#6B6459',
  },
  cardWrapper: {
    position: 'relative',
  },
  cardAnimWrapper: {
    width: '100%',
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(251,248,243,0.92)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelopeFlap: {
    width: 60,
    height: 4,
    backgroundColor: '#C75A3F',
    borderRadius: 2,
    marginBottom: 12,
  },
  tapOverlayText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#C75A3F',
    fontStyle: 'italic',
  },
  replayLink: {
    alignSelf: 'center',
    marginTop: 10,
  },
  replayLinkText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 13,
    color: '#6B6459',
  },
  summaryPill: {
    marginHorizontal: 24,
    backgroundColor: '#F0EDE8',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  summaryPillText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 13,
    color: '#6B6459',
    fontWeight: '500',
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: '#FBF8F3',
    borderTopWidth: 1,
    borderTopColor: '#E8E3DB',
    gap: 12,
  },
  editLink: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  editLinkText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#6B6459',
    fontWeight: '500',
  },
  ctaButton: {
    flex: 1,
    backgroundColor: '#C75A3F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

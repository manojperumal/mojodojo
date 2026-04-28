import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardDesign, Occasion } from '../types';

const OCCASION_GRADIENTS: Record<Occasion, readonly [string, string, ...string[]]> = {
  birthday: ['#F9D4C0', '#F7A58A', '#E8724A'],
  anniversary: ['#F4E0F7', '#D4A8E8', '#A855C8'],
  congratulations: ['#D4F4E0', '#A8E8C0', '#55C87A'],
  'thank-you': ['#FFF3D4', '#FFE0A8', '#F7C055'],
  'just-because': ['#D4E8F4', '#A8C8E8', '#5590C8'],
  holiday: ['#D4F4F4', '#A8E8E8', '#55C8C8'],
};

interface CardPreviewProps {
  cardDesign?: CardDesign | null;
  occasion?: Occasion | null;
  brandLogoUrl?: string;
  brandName?: string;
  message?: string;
  signature?: string;
  recipientName?: string;
  style?: object;
}

export default function CardPreview({
  cardDesign,
  occasion,
  brandLogoUrl,
  brandName,
  message,
  signature,
  recipientName,
  style,
}: CardPreviewProps): React.ReactElement {
  const gradientColors =
    cardDesign?.gradientColors && cardDesign.gradientColors.length >= 2
      ? (cardDesign.gradientColors as [string, string, ...string[]])
      : occasion
      ? OCCASION_GRADIENTS[occasion]
      : (['#F9D4C0', '#F7A58A'] as [string, string]);

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.topRow}>
          {recipientName ? (
            <Text style={styles.toText}>To {recipientName}</Text>
          ) : (
            <View />
          )}
        </View>

        {message ? (
          <View style={styles.messageContainer}>
            <Text style={styles.messageText} numberOfLines={4}>
              {message}
            </Text>
          </View>
        ) : null}

        <View style={styles.bottomRow}>
          {signature ? (
            <Text style={styles.signatureText}>{signature}</Text>
          ) : (
            <View />
          )}
          {brandLogoUrl ? (
            <Image
              source={{ uri: brandLogoUrl }}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : brandName ? (
            <View style={styles.brandNameBadge}>
              <Text style={styles.brandNameText}>{brandName}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    aspectRatio: 3 / 2,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  gradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  toText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 16,
    color: 'rgba(26,26,26,0.75)',
    fontStyle: 'italic',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  messageText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#1A1A1A',
    fontStyle: 'italic',
  },
  brandLogo: {
    width: 60,
    height: 36,
  },
  brandNameBadge: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  brandNameText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});

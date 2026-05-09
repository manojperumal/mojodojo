import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useGiftStore } from '../store/gift';
import { useAuthStore } from '../store/auth';
import { createGift, createPaymentIntent, payGift } from '../api/client';

type ReviewNavigationProp = StackNavigationProp<RootStackParamList, 'Review'>;

interface ReviewScreenProps {
  navigation: ReviewNavigationProp;
}

const SERVICE_FEE_RATE = 0.03;

export default function ReviewScreen({ navigation }: ReviewScreenProps): React.ReactElement {
  const draft = useGiftStore((s) => s.draft);
  const setCreatedGiftId = useGiftStore((s) => s.setCreatedGiftId);
  const user = useAuthStore((s) => s.user);

  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const { confirmPayment } = useConfirmPayment();

  const giftAmount = draft.amount ?? 0;
  const serviceFee = Math.round(giftAmount * SERVICE_FEE_RATE * 100) / 100;
  const total = giftAmount + serviceFee;

  const getSignatureString = (): string => {
    if (draft.signatureMode === 'style') {
      return `${draft.signatureStyle}:${user?.name ?? ''}`;
    }
    if (draft.signatureMode === 'initials') {
      return draft.signatureInitials;
    }
    return draft.signatureDataUrl;
  };

  const handlePay = async () => {
    if (!cardComplete) {
      Alert.alert('Card required', 'Please enter your card details.');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create the gift
      const gift = await createGift({
        brandId: draft.brand?.id ?? '',
        amount: giftAmount,
        cardDesignId: draft.cardDesign?.id ?? 'default',
        recipientName: draft.recipientName,
        message: draft.message,
        signature: getSignatureString(),
        occasion: draft.occasion ?? 'birthday',
        deliveryMethod: draft.deliveryMethod,
        recipientPhone: draft.recipientPhone || undefined,
        recipientEmail: draft.recipientEmail || undefined,
        scheduledAt: draft.scheduledAt ? draft.scheduledAt.toISOString() : undefined,
      });

      setCreatedGiftId(gift.id);

      // 2. Create payment intent
      const { clientSecret } = await createPaymentIntent(gift.id);

      // 3. Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {
            email: user?.email,
            name: user?.name,
          },
        },
      });

      if (stripeError) {
        Alert.alert('Payment failed', stripeError.message ?? 'An error occurred.');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent) {
        // 4. Mark gift as paid
        await payGift(gift.id, paymentIntent.id);
        navigation.navigate('Confirmation');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      Alert.alert('Error', message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDelivery = (): string => {
    if (draft.deliveryMethod === 'sms') return `SMS to ${draft.recipientPhone}`;
    if (draft.deliveryMethod === 'email') return `Email to ${draft.recipientEmail}`;
    return 'Shareable link';
  };

  const formatWhen = (): string => {
    if (draft.sendNow) return 'Immediately after payment';
    if (draft.scheduledAt) {
      return new Date(draft.scheduledAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return 'Scheduled';
  };

  const summaryRows: { label: string; value: string }[] = [
    { label: 'Gift card', value: `${draft.brand?.name ?? '—'} $${giftAmount}` },
    { label: 'To', value: draft.recipientName || '—' },
    { label: 'Delivery', value: formatDelivery() },
    { label: 'Sending', value: formatWhen() },
    { label: 'Occasion', value: draft.occasion ? draft.occasion.replace('-', ' ') : '—' },
    { label: 'Design', value: draft.cardDesign?.name ?? 'Default' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.card}>
            {summaryRows.map((row, index) => (
              <React.Fragment key={row.label}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{row.label}</Text>
                  <Text style={styles.summaryValue}>{row.value}</Text>
                </View>
                {index < summaryRows.length - 1 && (
                  <View style={styles.divider} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.card}>
            <View style={styles.lineItem}>
              <Text style={styles.lineItemLabel}>
                Gift card ({draft.brand?.name ?? ''})
              </Text>
              <Text style={styles.lineItemValue}>${giftAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.lineItem}>
              <Text style={styles.lineItemLabel}>Service fee (3%)</Text>
              <Text style={styles.lineItemValue}>${serviceFee.toFixed(2)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.lineItem}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Card field */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card details</Text>
          <CardField
            postalCodeEnabled={true}
            placeholder={{
              number: '4242 4242 4242 4242',
            }}
            cardStyle={{
              backgroundColor: '#FFFFFF',
              textColor: '#1A1A1A',
              placeholderColor: '#6B6459',
              borderColor: '#E8E3DB',
              borderWidth: 1,
              borderRadius: 10,
            }}
            style={styles.cardField}
            onCardChange={(cardDetails) => {
              setCardComplete(cardDetails.complete);
            }}
          />
          <View style={styles.secureRow}>
            <Text style={styles.secureLock}>🔒</Text>
            <Text style={styles.secureText}>Payments secured by Stripe</Text>
          </View>
        </View>
      </ScrollView>

      {/* Pay button */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[
            styles.ctaButton,
            (!cardComplete || isProcessing) && styles.ctaButtonDisabled,
          ]}
          onPress={handlePay}
          disabled={!cardComplete || isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaButtonText}>
              Send gift ${total.toFixed(2)} →
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.termsText}>
          By tapping send you agree to our Terms of Service.
        </Text>
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
    paddingBottom: 140,
    paddingTop: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#6B6459',
    flex: 1,
  },
  summaryValue: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E3DB',
    marginHorizontal: 16,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lineItemLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#6B6459',
  },
  lineItemValue: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  totalDivider: {
    height: 1.5,
    backgroundColor: '#E8E3DB',
    marginHorizontal: 16,
  },
  totalLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  totalValue: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cardField: {
    width: '100%',
    height: 50,
    marginBottom: 8,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  secureLock: {
    fontSize: 12,
  },
  secureText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 12,
    color: '#6B6459',
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: '#FBF8F3',
    borderTopWidth: 1,
    borderTopColor: '#E8E3DB',
  },
  ctaButton: {
    backgroundColor: '#C75A3F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  ctaButtonDisabled: {
    backgroundColor: '#E8E3DB',
  },
  ctaButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  termsText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 11,
    color: '#6B6459',
    textAlign: 'center',
  },
});

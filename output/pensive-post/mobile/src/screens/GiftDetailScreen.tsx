import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Gift, GiftStatus } from '../types';
import { getSentGifts, nudgeGift, recallGift } from '../api/client';
import CardPreview from '../components/CardPreview';

type GiftDetailNavigationProp = StackNavigationProp<RootStackParamList, 'GiftDetail'>;
type GiftDetailRouteProp = RouteProp<RootStackParamList, 'GiftDetail'>;

interface GiftDetailScreenProps {
  navigation: GiftDetailNavigationProp;
  route: GiftDetailRouteProp;
}

const STATUS_CONFIG: Record<GiftStatus, { label: string; backgroundColor: string; color: string }> = {
  draft: { label: 'Draft', backgroundColor: '#F0EDE8', color: '#6B6459' },
  scheduled: { label: 'Scheduled', backgroundColor: '#FFF3D4', color: '#C07800' },
  sent: { label: 'Sent', backgroundColor: '#D4E8F4', color: '#1A6098' },
  opened: { label: 'Opened', backgroundColor: '#D4F4E0', color: '#1A7A40' },
  redeemed: { label: 'Redeemed', backgroundColor: '#E8D4F4', color: '#6A1A8A' },
  recalled: { label: 'Recalled', backgroundColor: '#FFE8E8', color: '#8A1A1A' },
};

function daysSince(dateString?: string): number {
  if (!dateString) return 0;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function GiftDetailScreen({ navigation, route }: GiftDetailScreenProps): React.ReactElement {
  const { giftId } = route.params;

  const [gift, setGift] = useState<Gift | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [recalling, setRecalling] = useState(false);

  const loadGift = useCallback(async () => {
    try {
      const gifts = await getSentGifts();
      const found = gifts.find((g) => g.id === giftId);
      if (found) setGift(found);
    } catch {
      // Could not load gift
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [giftId]);

  useEffect(() => {
    loadGift();
  }, [loadGift]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGift();
  };

  const handleNudge = async () => {
    if (!gift) return;
    setNudging(true);
    try {
      await nudgeGift(gift.id);
      Alert.alert('Nudge sent', `We sent ${gift.recipientName} a gentle reminder.`);
    } catch {
      Alert.alert('Error', 'Could not send nudge. Please try again.');
    } finally {
      setNudging(false);
    }
  };

  const handleRecall = () => {
    if (!gift) return;
    Alert.alert(
      'Recall gift?',
      `This will cancel the gift to ${gift.recipientName} and the ${gift.brand.name} code won't be sent. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recall',
          style: 'destructive',
          onPress: async () => {
            setRecalling(true);
            try {
              const updated = await recallGift(gift.id);
              setGift(updated);
            } catch {
              Alert.alert('Error', 'Could not recall gift. It may have already been opened.');
            } finally {
              setRecalling(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C75A3F" />
      </View>
    );
  }

  if (!gift) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Gift not found.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[gift.status];
  const sentDaysAgo = daysSince(gift.sentAt);
  const showNudge =
    gift.status === 'sent' &&
    sentDaysAgo >= 7 &&
    !gift.openedAt;

  const canRecall = gift.status === 'sent' || gift.status === 'scheduled' || gift.status === 'draft';

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#C75A3F"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Status pill */}
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: statusConfig.backgroundColor }]}>
          <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
        {gift.status === 'sent' && gift.sentAt && (
          <Text style={styles.daysAgoText}>
            Sent {sentDaysAgo === 0 ? 'today' : `${sentDaysAgo}d ago`}
          </Text>
        )}
      </View>

      {/* Card preview */}
      <View style={styles.cardSection}>
        <CardPreview
          cardDesign={gift.cardDesign}
          occasion={gift.occasion}
          brandLogoUrl={gift.brand.logoUrl}
          brandName={gift.brand.name}
          message={gift.message}
          recipientName={gift.recipientName}
        />
      </View>

      {/* Gift details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gift Details</Text>
        <View style={styles.detailsCard}>
          {[
            { label: 'Recipient', value: gift.recipientName },
            { label: 'Brand', value: gift.brand.name },
            { label: 'Amount', value: `$${gift.amount}` },
            {
              label: 'Delivery',
              value: gift.deliveryMethod === 'sms'
                ? `SMS ${gift.recipientPhone ? `to ${gift.recipientPhone}` : ''}`
                : gift.deliveryMethod === 'email'
                ? `Email ${gift.recipientEmail ? `to ${gift.recipientEmail}` : ''}`
                : 'Link',
            },
            { label: 'Occasion', value: gift.occasion.replace('-', ' ') },
            { label: 'Created', value: formatDate(gift.createdAt) },
            { label: 'Sent', value: formatDate(gift.sentAt) },
            { label: 'Opened', value: formatDate(gift.openedAt) },
            { label: 'Redeemed', value: formatDate(gift.redeemedAt) },
          ].map((row, index, arr) => (
            <React.Fragment key={row.label}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={styles.detailValue}>{row.value}</Text>
              </View>
              {index < arr.length - 1 && (
                <View style={styles.divider} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Nudge prompt */}
      {showNudge && (
        <View style={styles.nudgeCard}>
          <Text style={styles.nudgeTitle}>Still unopened</Text>
          <Text style={styles.nudgeBody}>
            {gift.recipientName} hasn't opened the card yet. Send a friendly nudge?
          </Text>
          <TouchableOpacity
            style={[styles.nudgeButton, nudging && styles.nudgeButtonLoading]}
            onPress={handleNudge}
            disabled={nudging}
            activeOpacity={0.7}
          >
            {nudging ? (
              <ActivityIndicator color="#C75A3F" />
            ) : (
              <Text style={styles.nudgeButtonText}>Send nudge 👋</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Recall */}
      {canRecall && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.recallButton, recalling && styles.recallButtonLoading]}
            onPress={handleRecall}
            disabled={recalling}
            activeOpacity={0.7}
          >
            {recalling ? (
              <ActivityIndicator color="#8A1A1A" />
            ) : (
              <Text style={styles.recallButtonText}>Recall gift</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.recallHint}>
            Cancels the gift before it's redeemed. Cannot be undone.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF8F3',
    gap: 16,
  },
  errorText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#6B6459',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#C75A3F',
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  statusPill: {
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusPillText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 13,
    fontWeight: '600',
  },
  daysAgoText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 13,
    color: '#6B6459',
  },
  cardSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
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
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  detailLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#6B6459',
    flex: 1,
  },
  detailValue: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E3DB',
    marginHorizontal: 16,
  },
  nudgeCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#FFF8F6',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C75A3F',
    padding: 18,
  },
  nudgeTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 6,
  },
  nudgeBody: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#6B6459',
    lineHeight: 20,
    marginBottom: 14,
  },
  nudgeButton: {
    backgroundColor: '#C75A3F',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nudgeButtonLoading: {
    opacity: 0.7,
  },
  nudgeButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recallButton: {
    borderWidth: 1.5,
    borderColor: '#E8A0A0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  recallButtonLoading: {
    opacity: 0.7,
  },
  recallButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    fontWeight: '600',
    color: '#8A1A1A',
  },
  recallHint: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 12,
    color: '#6B6459',
    textAlign: 'center',
  },
});

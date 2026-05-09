import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, CardDesign } from '../types';
import { useGiftStore } from '../store/gift';
import { getCardDesigns } from '../api/client';
import CardPreview from '../components/CardPreview';

type AmountCardNavigationProp = StackNavigationProp<RootStackParamList, 'AmountCard'>;

interface AmountCardScreenProps {
  navigation: AmountCardNavigationProp;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 24;
const CARD_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;

const AMOUNT_CHIPS = [15, 25, 50, 100];

const FALLBACK_DESIGNS: CardDesign[] = [
  { id: 'design-1', name: 'Warm Bloom', gradientColors: ['#F9D4C0', '#F7A58A', '#E8724A'], occasion: 'birthday' },
  { id: 'design-2', name: 'Dusk Rose', gradientColors: ['#F4E0F7', '#D4A8E8', '#A855C8'], occasion: 'anniversary' },
  { id: 'design-3', name: 'Spring Meadow', gradientColors: ['#D4F4E0', '#A8E8C0', '#55C87A'], occasion: 'congratulations' },
  { id: 'design-4', name: 'Golden Hour', gradientColors: ['#FFF3D4', '#FFE0A8', '#F7C055'], occasion: 'thank-you' },
];

export default function AmountCardScreen({ navigation }: AmountCardScreenProps): React.ReactElement {
  const draft = useGiftStore((s) => s.draft);
  const setAmount = useGiftStore((s) => s.setAmount);
  const setCardDesign = useGiftStore((s) => s.setCardDesign);

  const [selectedAmount, setSelectedAmount] = useState<number | null>(draft.amount);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [designs, setDesigns] = useState<CardDesign[]>(FALLBACK_DESIGNS);
  const [currentDesignIndex, setCurrentDesignIndex] = useState(0);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  const swiperRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!draft.occasion) return;
    setLoadingDesigns(true);
    getCardDesigns(draft.occasion)
      .then((data) => {
        if (data && data.length > 0) {
          setDesigns(data);
          if (draft.cardDesign) {
            const idx = data.findIndex((d) => d.id === draft.cardDesign?.id);
            if (idx >= 0) setCurrentDesignIndex(idx);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDesigns(false));
  }, [draft.occasion]);

  useEffect(() => {
    if (!draft.cardDesign && designs.length > 0) {
      setCardDesign(designs[0]);
    }
  }, [designs]);

  const handleAmountChipPress = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount('');
    setAmount(amount);
  };

  const handleCustomPress = () => {
    setIsCustom(true);
    setSelectedAmount(null);
  };

  const handleCustomAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    if (cleaned) {
      const num = parseInt(cleaned, 10);
      setSelectedAmount(num);
      setAmount(num);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    if (index !== currentDesignIndex) {
      setCurrentDesignIndex(index);
      setCardDesign(designs[index]);
    }
  };

  const activeDesign = designs[currentDesignIndex] ?? designs[0];

  const canContinue = !!selectedAmount && selectedAmount > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Card Preview swiper */}
        <View style={styles.swiperSection}>
          {loadingDesigns ? (
            <View style={[styles.swiperContainer, styles.loaderContainer]}>
              <ActivityIndicator color="#C75A3F" />
            </View>
          ) : (
            <ScrollView
              ref={swiperRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              decelerationRate="fast"
              snapToInterval={CARD_WIDTH}
              snapToAlignment="start"
              contentContainerStyle={styles.swiperContent}
            >
              {designs.map((design, index) => (
                <View key={design.id} style={styles.swiperCard}>
                  <CardPreview
                    cardDesign={design}
                    occasion={draft.occasion}
                    brandLogoUrl={draft.brand?.logoUrl}
                    brandName={draft.brand?.name}
                    message={draft.message || undefined}
                    signature={
                      draft.signatureMode === 'style'
                        ? draft.signatureStyle
                        : draft.signatureInitials || undefined
                    }
                    recipientName={draft.recipientName || undefined}
                  />
                  <Text style={styles.designName}>{design.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Dot indicators */}
          {designs.length > 1 && (
            <View style={styles.dotContainer}>
              {designs.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentDesignIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Amount section */}
        <View style={styles.amountSection}>
          <Text style={styles.sectionLabel}>Choose an amount</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {AMOUNT_CHIPS.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.chip,
                  !isCustom && selectedAmount === amount && styles.chipSelected,
                ]}
                onPress={() => handleAmountChipPress(amount)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    !isCustom && selectedAmount === amount && styles.chipTextSelected,
                  ]}
                >
                  ${amount}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.chip, isCustom && styles.chipSelected]}
              onPress={handleCustomPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isCustom && styles.chipTextSelected]}>
                Custom
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {isCustom && (
            <View style={styles.customInputRow}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.customInput}
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                placeholder="0"
                placeholderTextColor="#6B6459"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
          )}

          {draft.brand && (
            <Text style={styles.amountHint}>
              {draft.brand.name} gift cards: ${draft.brand.minAmount}–${draft.brand.maxAmount}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
          onPress={() => {
            if (canContinue) navigation.navigate('Personalise');
          }}
          disabled={!canContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>Personalise →</Text>
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
  swiperSection: {
    paddingTop: 24,
    paddingBottom: 8,
  },
  swiperContainer: {
    height: (CARD_WIDTH * 2) / 3,
    marginHorizontal: CARD_PADDING,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  swiperContent: {
    paddingHorizontal: CARD_PADDING,
  },
  swiperCard: {
    width: CARD_WIDTH,
    marginRight: 0,
  },
  designName: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 13,
    color: '#6B6459',
    textAlign: 'center',
    marginTop: 8,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8E3DB',
  },
  dotActive: {
    backgroundColor: '#C75A3F',
    width: 18,
  },
  amountSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionLabel: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#1A1A1A',
    marginBottom: 16,
  },
  chipsRow: {
    paddingRight: 8,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E8E3DB',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    borderColor: '#C75A3F',
    backgroundColor: '#C75A3F',
  },
  chipText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: '#C75A3F',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  currencySymbol: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 22,
    color: '#6B6459',
    marginRight: 4,
  },
  customInput: {
    flex: 1,
    fontSize: 22,
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    color: '#1A1A1A',
    paddingVertical: 14,
  },
  amountHint: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 12,
    color: '#6B6459',
    marginTop: 8,
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
});

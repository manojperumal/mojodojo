import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, DeliveryMethod } from '../types';
import { useGiftStore } from '../store/gift';

type DeliveryNavigationProp = StackNavigationProp<RootStackParamList, 'Delivery'>;

interface DeliveryOption {
  method: DeliveryMethod;
  icon: string;
  label: string;
  description: string;
}

const DELIVERY_OPTIONS: DeliveryOption[] = [
  { method: 'sms', icon: '💬', label: 'SMS', description: 'Send via text message' },
  { method: 'email', icon: '✉️', label: 'Email', description: 'Send via email' },
  { method: 'link', icon: '🔗', label: 'Link', description: 'Copy and share a link' },
];

export default function DeliveryScreen({ navigation }: { navigation: DeliveryNavigationProp }): React.ReactElement {
  const draft = useGiftStore((s) => s.draft);
  const setDeliveryMethod = useGiftStore((s) => s.setDeliveryMethod);
  const setRecipientPhone = useGiftStore((s) => s.setRecipientPhone);
  const setRecipientEmail = useGiftStore((s) => s.setRecipientEmail);
  const setScheduledAt = useGiftStore((s) => s.setScheduledAt);
  const setSendNow = useGiftStore((s) => s.setSendNow);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>(
    draft.scheduledAt ? new Date(draft.scheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
  );

  const handleMethodSelect = (method: DeliveryMethod) => {
    setDeliveryMethod(method);
  };

  const handleSendNowToggle = (sendNow: boolean) => {
    setSendNow(sendNow);
    if (sendNow) {
      setScheduledAt(null);
      setShowDatePicker(false);
    } else {
      setScheduledAt(scheduleDate);
      if (Platform.OS === 'android') {
        setShowDatePicker(true);
      }
    }
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setScheduleDate(date);
      setScheduledAt(date);
    }
  };

  const isValid = () => {
    if (draft.deliveryMethod === 'sms') {
      return draft.recipientPhone.replace(/\D/g, '').length >= 10;
    }
    if (draft.deliveryMethod === 'email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.recipientEmail);
    }
    return true;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* How to deliver */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to deliver</Text>

          {DELIVERY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.method}
              style={[
                styles.optionCard,
                draft.deliveryMethod === option.method && styles.optionCardSelected,
              ]}
              onPress={() => handleMethodSelect(option.method)}
              activeOpacity={0.7}
            >
              <View style={styles.optionRadio}>
                <View
                  style={[
                    styles.radioOuter,
                    draft.deliveryMethod === option.method && styles.radioOuterSelected,
                  ]}
                >
                  {draft.deliveryMethod === option.method && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
              <Text style={styles.optionIcon}>{option.icon}</Text>
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recipient input */}
        {draft.deliveryMethod === 'sms' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient's phone</Text>
            <TextInput
              style={styles.textInput}
              value={draft.recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="#6B6459"
              keyboardType="phone-pad"
              returnKeyType="done"
              autoCorrect={false}
            />
          </View>
        )}

        {draft.deliveryMethod === 'email' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient's email</Text>
            <TextInput
              style={styles.textInput}
              value={draft.recipientEmail}
              onChangeText={setRecipientEmail}
              placeholder="friend@example.com"
              placeholderTextColor="#6B6459"
              keyboardType="email-address"
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {draft.deliveryMethod === 'link' && (
          <View style={styles.section}>
            <View style={styles.linkInfoCard}>
              <Text style={styles.linkInfoText}>
                A shareable link will be generated after payment. You can copy and send it
                however you like.
              </Text>
            </View>
          </View>
        )}

        {/* When to send */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>When to send</Text>

          <TouchableOpacity
            style={[styles.optionCard, draft.sendNow && styles.optionCardSelected]}
            onPress={() => handleSendNowToggle(true)}
            activeOpacity={0.7}
          >
            <View style={styles.optionRadio}>
              <View style={[styles.radioOuter, draft.sendNow && styles.radioOuterSelected]}>
                {draft.sendNow && <View style={styles.radioInner} />}
              </View>
            </View>
            <Text style={styles.optionIcon}>⚡</Text>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Send now</Text>
              <Text style={styles.optionDescription}>Deliver immediately after payment</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, !draft.sendNow && styles.optionCardSelected]}
            onPress={() => handleSendNowToggle(false)}
            activeOpacity={0.7}
          >
            <View style={styles.optionRadio}>
              <View style={[styles.radioOuter, !draft.sendNow && styles.radioOuterSelected]}>
                {!draft.sendNow && <View style={styles.radioInner} />}
              </View>
            </View>
            <Text style={styles.optionIcon}>📅</Text>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Schedule</Text>
              <Text style={styles.optionDescription}>
                {!draft.sendNow && draft.scheduledAt
                  ? `Sending ${formatDate(new Date(draft.scheduledAt))}`
                  : 'Choose a date and time'}
              </Text>
            </View>
          </TouchableOpacity>

          {!draft.sendNow && (
            <>
              {Platform.OS === 'ios' ? (
                <View style={styles.iosPickerWrapper}>
                  <DateTimePicker
                    value={scheduleDate}
                    mode="datetime"
                    display="inline"
                    minimumDate={new Date()}
                    onChange={handleDateChange}
                    accentColor="#C75A3F"
                    themeVariant="light"
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dateButtonText}>
                      {formatDate(scheduleDate)}
                    </Text>
                    <Text style={styles.dateButtonChevron}>›</Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={scheduleDate}
                      mode="datetime"
                      display="default"
                      minimumDate={new Date()}
                      onChange={handleDateChange}
                    />
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, !isValid() && styles.ctaButtonDisabled]}
          onPress={() => {
            if (isValid()) navigation.navigate('Preview');
          }}
          disabled={!isValid()}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>Preview →</Text>
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
    paddingTop: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#1A1A1A',
    marginBottom: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E3DB',
    padding: 16,
    marginBottom: 10,
  },
  optionCardSelected: {
    borderColor: '#C75A3F',
    backgroundColor: '#FFF8F6',
  },
  optionRadio: {
    marginRight: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E8E3DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#C75A3F',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C75A3F',
  },
  optionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  optionDescription: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 13,
    color: '#6B6459',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    color: '#1A1A1A',
  },
  linkInfoCard: {
    backgroundColor: '#F0EDE8',
    borderRadius: 10,
    padding: 16,
  },
  linkInfoText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#6B6459',
    lineHeight: 20,
  },
  iosPickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    marginTop: 8,
    overflow: 'hidden',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  dateButtonText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#1A1A1A',
  },
  dateButtonChevron: {
    fontSize: 20,
    color: '#6B6459',
  },
  ctaContainer: {
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

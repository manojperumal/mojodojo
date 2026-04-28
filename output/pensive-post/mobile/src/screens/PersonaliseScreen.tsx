import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  Pressable,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import SignatureCanvas, { SignatureViewRef } from 'react-native-signature-canvas';
import { RootStackParamList, SignatureMode } from '../types';
import { useGiftStore } from '../store/gift';

type PersonaliseNavigationProp = StackNavigationProp<RootStackParamList, 'Personalise'>;

interface PersonaliseScreenProps {
  navigation: PersonaliseNavigationProp;
}

const SIGNATURE_STYLES = [
  { id: 'cursive-1', label: 'Elegant', fontFamily: Platform.select({ ios: 'Zapfino', android: 'serif' }) ?? 'serif' },
  { id: 'cursive-2', label: 'Classic', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) ?? 'serif' },
  { id: 'cursive-3', label: 'Modern', fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }) ?? 'sans-serif' },
  { id: 'cursive-4', label: 'Playful', fontFamily: Platform.select({ ios: 'Chalkboard SE', android: 'serif' }) ?? 'serif' },
];

const MONOGRAM_STYLES = [
  { id: 'monogram-circle', shape: 'circle' as const, label: 'Circle' },
  { id: 'monogram-square', shape: 'square' as const, label: 'Square' },
];

export default function PersonaliseScreen({ navigation }: PersonaliseScreenProps): React.ReactElement {
  const draft = useGiftStore((s) => s.draft);
  const setRecipientName = useGiftStore((s) => s.setRecipientName);
  const setMessage = useGiftStore((s) => s.setMessage);
  const setSignatureMode = useGiftStore((s) => s.setSignatureMode);
  const setSignatureStyle = useGiftStore((s) => s.setSignatureStyle);
  const setSignatureDataUrl = useGiftStore((s) => s.setSignatureDataUrl);
  const setSignatureInitials = useGiftStore((s) => s.setSignatureInitials);

  const [activeTab, setActiveTab] = useState<SignatureMode>(draft.signatureMode);
  const [selectedStyleId, setSelectedStyleId] = useState(draft.signatureStyle || 'cursive-1');
  const [selectedMonogram, setSelectedMonogram] = useState<string>(MONOGRAM_STYLES[0].id);
  const signatureRef = useRef<SignatureViewRef>(null);

  const senderName = 'You'; // Would come from auth store in a real app

  const handleTabChange = (mode: SignatureMode) => {
    setActiveTab(mode);
    setSignatureMode(mode);
  };

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
    setSignatureStyle(styleId);
  };

  const handleSignatureOK = (signature: string) => {
    setSignatureDataUrl(signature);
  };

  const handleSignatureClear = () => {
    signatureRef.current?.clearSignature();
    setSignatureDataUrl('');
  };

  const handleMonogramSelect = (id: string, shape: 'circle' | 'square') => {
    setSelectedMonogram(id);
    const initials = draft.recipientName
      ? draft.recipientName
          .split(' ')
          .map((w) => w[0]?.toUpperCase())
          .filter(Boolean)
          .join('')
          .slice(0, 2)
      : 'PP';
    setSignatureInitials(`${initials}:${shape}`);
  };

  const canContinue = !!draft.recipientName.trim();

  const renderSignatureStyleItem = ({ item }: { item: typeof SIGNATURE_STYLES[0] }) => (
    <TouchableOpacity
      style={[styles.styleOption, selectedStyleId === item.id && styles.styleOptionSelected]}
      onPress={() => handleStyleSelect(item.id)}
      activeOpacity={0.7}
    >
      <Text style={[styles.stylePreview, { fontFamily: item.fontFamily }]}>
        {senderName}
      </Text>
      <Text style={styles.styleLabel}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={88}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* To: field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>To</Text>
          <TextInput
            style={styles.textInput}
            value={draft.recipientName}
            onChangeText={setRecipientName}
            placeholder="Recipient's name"
            placeholderTextColor="#6B6459"
            returnKeyType="next"
            autoCapitalize="words"
          />
        </View>

        {/* Message */}
        <View style={styles.fieldGroup}>
          <View style={styles.messageLabelRow}>
            <Text style={styles.fieldLabel}>Message</Text>
            <Text style={styles.charCount}>
              {draft.message.length}/300
            </Text>
          </View>
          <TextInput
            style={[styles.textInput, styles.messageInput]}
            value={draft.message}
            onChangeText={(text) => {
              if (text.length <= 300) setMessage(text);
            }}
            placeholder="Write something heartfelt..."
            placeholderTextColor="#6B6459"
            multiline
            maxLength={300}
            textAlignVertical="top"
            returnKeyType="default"
          />
        </View>

        {/* Signature */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Signature</Text>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {(['style', 'draw', 'initials'] as SignatureMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.tab, activeTab === mode && styles.tabActive]}
                onPress={() => handleTabChange(mode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === mode && styles.tabTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Style tab */}
          {activeTab === 'style' && (
            <FlatList
              data={SIGNATURE_STYLES}
              renderItem={renderSignatureStyleItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stylesList}
              scrollEnabled
            />
          )}

          {/* Draw tab */}
          {activeTab === 'draw' && (
            <View style={styles.signatureCanvasContainer}>
              <SignatureCanvas
                ref={signatureRef}
                onOK={handleSignatureOK}
                onEmpty={() => setSignatureDataUrl('')}
                descriptionText=""
                clearText="Clear"
                confirmText="Save"
                style={styles.signatureCanvas}
                webStyle={`
                  .m-signature-pad {
                    box-shadow: none;
                    border: none;
                  }
                  .m-signature-pad--body {
                    border: 1px solid #E8E3DB;
                    border-radius: 10px;
                    background: #FFFFFF;
                  }
                  .m-signature-pad--footer {
                    background: transparent;
                  }
                  .m-signature-pad--footer .button {
                    background-color: #C75A3F;
                    color: #FFFFFF;
                    border-radius: 8px;
                    padding: 8px 20px;
                    font-size: 14px;
                  }
                  .m-signature-pad--footer .button.clear {
                    background-color: #E8E3DB;
                    color: #1A1A1A;
                  }
                `}
              />
              <TouchableOpacity style={styles.clearSignatureBtn} onPress={handleSignatureClear}>
                <Text style={styles.clearSignatureBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Initials tab */}
          {activeTab === 'initials' && (
            <View style={styles.monogramRow}>
              {MONOGRAM_STYLES.map((item) => {
                const initials = draft.recipientName
                  ? draft.recipientName
                      .split(' ')
                      .map((w) => w[0]?.toUpperCase())
                      .filter(Boolean)
                      .join('')
                      .slice(0, 2)
                  : 'AB';
                const isSelected = selectedMonogram === item.id;

                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.monogramOption,
                      item.shape === 'circle' ? styles.monogramCircle : styles.monogramSquare,
                      isSelected && styles.monogramSelected,
                    ]}
                    onPress={() => handleMonogramSelect(item.id, item.shape)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label} monogram`}
                  >
                    <Text style={[styles.monogramInitials, isSelected && styles.monogramInitialsSelected]}>
                      {initials}
                    </Text>
                    <Text style={[styles.styleLabel, { marginTop: 6 }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
          onPress={() => {
            if (canContinue) navigation.navigate('Delivery');
          }}
          disabled={!canContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>Delivery →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  fieldGroup: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 17,
    color: '#1A1A1A',
    marginBottom: 10,
  },
  messageLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  charCount: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 12,
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
  messageInput: {
    minHeight: 120,
    paddingTop: 14,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#C75A3F',
  },
  tabText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6459',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stylesList: {
    paddingRight: 8,
    gap: 12,
  },
  styleOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8E3DB',
    alignItems: 'center',
    minWidth: 100,
  },
  styleOptionSelected: {
    borderColor: '#C75A3F',
    backgroundColor: '#FFF8F6',
  },
  stylePreview: {
    fontSize: 18,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  styleLabel: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 11,
    color: '#6B6459',
  },
  signatureCanvasContainer: {
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    overflow: 'hidden',
  },
  signatureCanvas: {
    flex: 1,
  },
  clearSignatureBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E3DB',
  },
  clearSignatureBtnText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 12,
    color: '#6B6459',
  },
  monogramRow: {
    flexDirection: 'row',
    gap: 16,
  },
  monogramOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 1.5,
    borderColor: '#E8E3DB',
    backgroundColor: '#FFFFFF',
  },
  monogramCircle: {
    borderRadius: 60,
  },
  monogramSquare: {
    borderRadius: 10,
  },
  monogramSelected: {
    borderColor: '#C75A3F',
    backgroundColor: '#FFF8F6',
  },
  monogramInitials: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: 2,
  },
  monogramInitialsSelected: {
    color: '#C75A3F',
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

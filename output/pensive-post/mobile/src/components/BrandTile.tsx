import React from 'react';
import {
  Pressable,
  Image,
  Text,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { Brand } from '../types';

interface BrandTileProps {
  brand: Brand;
  selected: boolean;
  onPress: () => void;
}

export default function BrandTile({
  brand,
  selected,
  onPress,
}: BrandTileProps): React.ReactElement {
  return (
    <Pressable
      style={[styles.tile, selected && styles.selectedTile]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={brand.name}
      accessibilityState={{ selected }}
    >
      {brand.logoUrl ? (
        <Image
          source={{ uri: brand.logoUrl }}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.logoPlaceholder, { backgroundColor: brand.accentColor + '22' }]}>
          <Text style={[styles.logoInitial, { color: brand.accentColor }]}>
            {brand.name[0]}
          </Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {brand.name}
      </Text>
      {selected && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    margin: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E3DB',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  selectedTile: {
    borderColor: '#C75A3F',
    borderWidth: 2,
    backgroundColor: '#FFF8F6',
  },
  logo: {
    width: 56,
    height: 40,
    marginBottom: 6,
  },
  logoPlaceholder: {
    width: 56,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoInitial: {
    fontSize: 22,
    fontWeight: '700',
  },
  name: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    color: '#1A1A1A',
    fontWeight: '500',
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#C75A3F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

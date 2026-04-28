import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, Brand } from '../types';
import { useGiftStore } from '../store/gift';
import { getBrands } from '../api/client';
import BrandTile from '../components/BrandTile';

type BrandPickerNavigationProp = StackNavigationProp<RootStackParamList, 'BrandPicker'>;

interface BrandPickerScreenProps {
  navigation: BrandPickerNavigationProp;
}

const FALLBACK_BRANDS: Brand[] = [
  {
    id: 'starbucks',
    name: 'Starbucks',
    logoUrl: '',
    accentColor: '#00704A',
    category: 'Coffee',
    recommended: true,
    denominations: [15, 25, 50],
    minAmount: 5,
    maxAmount: 250,
  },
  {
    id: 'doordash',
    name: 'DoorDash',
    logoUrl: '',
    accentColor: '#FF3008',
    category: 'Food',
    recommended: true,
    denominations: [25, 50, 100],
    minAmount: 10,
    maxAmount: 500,
  },
  {
    id: 'amazon',
    name: 'Amazon',
    logoUrl: '',
    accentColor: '#FF9900',
    category: 'Shopping',
    recommended: true,
    denominations: [25, 50, 100],
    minAmount: 1,
    maxAmount: 2000,
  },
  {
    id: 'netflix',
    name: 'Netflix',
    logoUrl: '',
    accentColor: '#E50914',
    category: 'Entertainment',
    recommended: true,
    denominations: [25, 50, 100],
    minAmount: 15,
    maxAmount: 100,
  },
  {
    id: 'uber-eats',
    name: 'Uber Eats',
    logoUrl: '',
    accentColor: '#06C167',
    category: 'Food',
    recommended: false,
    denominations: [25, 50],
    minAmount: 10,
    maxAmount: 500,
  },
  {
    id: 'apple',
    name: 'Apple',
    logoUrl: '',
    accentColor: '#555555',
    category: 'Tech',
    recommended: false,
    denominations: [15, 25, 50, 100],
    minAmount: 10,
    maxAmount: 500,
  },
];

export default function BrandPickerScreen({ navigation }: BrandPickerScreenProps): React.ReactElement {
  const setBrand = useGiftStore((s) => s.setBrand);
  const selectedBrand = useGiftStore((s) => s.draft.brand);

  const [brands, setBrands] = useState<Brand[]>(FALLBACK_BRANDS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    getBrands()
      .then((data) => {
        if (data && data.length > 0) setBrands(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const recommendedBrands = useMemo(
    () => brands.filter((b) => b.recommended),
    [brands],
  );

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q),
    );
  }, [brands, searchQuery]);

  const handleSelect = (brand: Brand) => {
    setBrand(brand);
    navigation.navigate('AmountCard');
  };

  const renderRecommendedItem = ({ item }: { item: Brand }) => (
    <View style={styles.recommendedTileWrapper}>
      <BrandTile
        brand={item}
        selected={selectedBrand?.id === item.id}
        onPress={() => handleSelect(item)}
      />
    </View>
  );

  const renderAllBrandsRow = ({ item }: { item: Brand[] }) => (
    <View style={styles.allBrandsRow}>
      {item.map((brand) => (
        <View key={brand.id} style={styles.allBrandsTile}>
          <BrandTile
            brand={brand}
            selected={selectedBrand?.id === brand.id}
            onPress={() => handleSelect(brand)}
          />
        </View>
      ))}
      {item.length === 1 && <View style={styles.allBrandsTile} />}
    </View>
  );

  const pairedBrands = useMemo(() => {
    const pairs: Brand[][] = [];
    for (let i = 0; i < filteredBrands.length; i += 2) {
      pairs.push(filteredBrands.slice(i, i + 2));
    }
    return pairs;
  }, [filteredBrands]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search brands..."
          placeholderTextColor="#6B6459"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#C75A3F" style={styles.loader} />
      ) : (
        <>
          {/* Recommended */}
          {!searchQuery && recommendedBrands.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recommended</Text>
              <FlatList
                data={recommendedBrands}
                renderItem={renderRecommendedItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendedList}
              />
            </View>
          )}

          {/* All Brands */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {searchQuery ? 'Results' : 'All Brands'}
            </Text>
            {filteredBrands.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No brands match "{searchQuery}"</Text>
              </View>
            ) : (
              <FlatList
                data={pairedBrands}
                renderItem={renderAllBrandsRow}
                keyExtractor={(_, index) => `row-${index}`}
                scrollEnabled={false}
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E3DB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    color: '#1A1A1A',
  },
  loader: {
    marginTop: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 18,
    color: '#1A1A1A',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  recommendedList: {
    paddingHorizontal: 18,
  },
  recommendedTileWrapper: {
    width: 110,
    marginRight: 0,
  },
  allBrandsRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  allBrandsTile: {
    flex: 1,
  },
  emptyState: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  emptyText: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 14,
    color: '#6B6459',
  },
});

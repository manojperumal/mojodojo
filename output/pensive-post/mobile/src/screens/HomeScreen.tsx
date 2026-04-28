import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, Occasion } from '../types';
import { useGiftStore } from '../store/gift';
import { useAuthStore } from '../store/auth';
import { getOccasions, OccasionData } from '../api/client';
import OccasionCard from '../components/OccasionCard';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

const FALLBACK_OCCASIONS: OccasionData[] = [
  { id: 'birthday', label: 'Birthday', emoji: '🎂', gradients: ['#F9D4C0', '#E8724A'] },
  { id: 'anniversary', label: 'Anniversary', emoji: '💐', gradients: ['#F4E0F7', '#A855C8'] },
  { id: 'congratulations', label: 'Congrats', emoji: '🎉', gradients: ['#D4F4E0', '#55C87A'] },
  { id: 'thank-you', label: 'Thank You', emoji: '🙏', gradients: ['#FFF3D4', '#F7C055'] },
  { id: 'just-because', label: 'Just Because', emoji: '💛', gradients: ['#D4E8F4', '#5590C8'] },
  { id: 'holiday', label: 'Holiday', emoji: '✨', gradients: ['#D4F4F4', '#55C8C8'] },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }: HomeScreenProps): React.ReactElement {
  const setOccasion = useGiftStore((s) => s.setOccasion);
  const resetDraft = useGiftStore((s) => s.resetDraft);
  const user = useAuthStore((s) => s.user);

  const [occasions, setOccasions] = useState<OccasionData[]>(FALLBACK_OCCASIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getOccasions()
      .then((data) => {
        if (data && data.length > 0) {
          setOccasions(data);
        }
      })
      .catch(() => {
        // Use fallback data silently
      })
      .finally(() => setLoading(false));
  }, []);

  const handleOccasionPress = (occasion: Occasion) => {
    resetDraft();
    setOccasion(occasion);
    navigation.navigate('BrandPicker');
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const greeting = `${getGreeting()}, ${firstName}.`;

  const renderItem = ({ item }: { item: OccasionData }) => (
    <OccasionCard
      occasion={item.id}
      label={item.label}
      emoji={item.emoji}
      onPress={() => handleOccasionPress(item.id)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subtitle}>What's the occasion?</Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#C75A3F"
            style={styles.loader}
          />
        ) : (
          <FlatList
            data={occasions}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBF8F3',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  greeting: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 28,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Platform.select({ ios: '-apple-system', android: 'Roboto' }),
    fontSize: 15,
    color: '#6B6459',
  },
  loader: {
    marginTop: 60,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
});

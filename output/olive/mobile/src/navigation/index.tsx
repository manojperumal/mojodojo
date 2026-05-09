import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';

import HomeScreen from '../screens/HomeScreen';
import BrandPickerScreen from '../screens/BrandPickerScreen';
import AmountCardScreen from '../screens/AmountCardScreen';
import PersonaliseScreen from '../screens/PersonaliseScreen';
import DeliveryScreen from '../screens/DeliveryScreen';
import PreviewScreen from '../screens/PreviewScreen';
import ReviewScreen from '../screens/ReviewScreen';
import ConfirmationScreen from '../screens/ConfirmationScreen';
import GiftDetailScreen from '../screens/GiftDetailScreen';
import RecipientView from '../screens/RecipientView';

const Stack = createStackNavigator<RootStackParamList>();

const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif' }) ?? 'Georgia';

const headerBaseStyle = {
  headerStyle: {
    backgroundColor: '#FBF8F3',
    shadowColor: 'transparent',
    elevation: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E3DB',
  } as object,
  headerTintColor: '#1A1A1A',
  headerTitleStyle: {
    fontFamily: DISPLAY_FONT,
    fontSize: 18,
    color: '#1A1A1A',
  },
  headerBackTitleVisible: false,
};

export default function AppNavigator(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        ...headerBaseStyle,
        cardStyle: { backgroundColor: '#FBF8F3' },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Olive', headerShown: true }}
      />
      <Stack.Screen
        name="BrandPicker"
        component={BrandPickerScreen}
        options={{ title: 'Choose a brand' }}
      />
      <Stack.Screen
        name="AmountCard"
        component={AmountCardScreen}
        options={{ title: 'Amount & Design' }}
      />
      <Stack.Screen
        name="Personalise"
        component={PersonaliseScreen}
        options={{ title: 'Personalise' }}
      />
      <Stack.Screen
        name="Delivery"
        component={DeliveryScreen}
        options={{ title: 'Delivery' }}
      />
      <Stack.Screen
        name="Preview"
        component={PreviewScreen}
        options={{ title: 'Preview' }}
      />
      <Stack.Screen
        name="Review"
        component={ReviewScreen}
        options={{ title: 'Review & Pay' }}
      />
      <Stack.Screen
        name="Confirmation"
        component={ConfirmationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GiftDetail"
        component={GiftDetailScreen}
        options={{ title: 'Gift Detail' }}
      />
      <Stack.Screen
        name="RecipientView"
        component={RecipientView}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

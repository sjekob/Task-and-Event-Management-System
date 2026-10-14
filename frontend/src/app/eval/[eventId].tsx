import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import PublicEvaluationScreen from '../../screens/PublicEvaluationScreen';

export default function Route() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <PublicEvaluationScreen eventId={eventId} />;
}

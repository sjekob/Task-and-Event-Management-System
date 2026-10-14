import { Redirect } from 'expo-router';
import React from 'react';
import { useAppState } from '../services/appState';

export default function Index() {
  const state = useAppState();
  return <Redirect href={state.isLoggedIn ? '/dashboard' : '/login'} />;
}

import { Slot } from 'expo-router';
import React from 'react';
import MainShell from '../../screens/MainShell';

export default function ShellLayout() {
  return (
    <MainShell>
      <Slot />
    </MainShell>
  );
}

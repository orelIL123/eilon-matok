import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth } from '../../config/firebase';

interface AppAuthGateProps {
  children: React.ReactNode;
}

export default function AppAuthGate({ children }: AppAuthGateProps) {
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Set a shorter timeout since splash screen also handles auth checking
    const timeout = setTimeout(() => {
      setIsAuthReady(true);
    }, 1000);

    const unsubscribe = onAuthStateChanged(auth, () => {
      clearTimeout(timeout);
      setIsAuthReady(true);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  // Don't show loading screen, let splash screen handle the auth flow
  // This gate just ensures Firebase Auth is ready
  if (!isAuthReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {children}
      </View>
    );
  }

  return <>{children}</>;
}
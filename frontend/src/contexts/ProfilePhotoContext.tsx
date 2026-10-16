import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchPatientProfile } from '../services/profileService';

interface ProfilePhotoContextType {
  photoUrl: string | null;
  isLoading: boolean;
  refreshPhoto: () => Promise<void>;
  setPhotoUrl: (url: string | null) => void;
}

export const ProfilePhotoContext = createContext<ProfilePhotoContextType | undefined>(undefined);

export function ProfilePhotoProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshPhoto = useCallback(async () => {
    if (!user) {
      setPhotoUrl(null);
      return;
    }

    try {
      setIsLoading(true);
      const profile = await fetchPatientProfile();
      setPhotoUrl(profile?.photo_url ?? null);
    } catch {
      setPhotoUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    void refreshPhoto();
  }, [isAuthLoading, refreshPhoto]);

  const value = useMemo(
    () => ({
      photoUrl,
      isLoading,
      refreshPhoto,
      setPhotoUrl,
    }),
    [isLoading, photoUrl, refreshPhoto],
  );

  return <ProfilePhotoContext.Provider value={value}>{children}</ProfilePhotoContext.Provider>;
}

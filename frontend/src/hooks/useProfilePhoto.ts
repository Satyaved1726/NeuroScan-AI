import { useContext } from 'react';
import { ProfilePhotoContext } from '../contexts/ProfilePhotoContext';

export function useProfilePhoto() {
  const context = useContext(ProfilePhotoContext);
  if (context === undefined) {
    throw new Error('useProfilePhoto must be used within a ProfilePhotoProvider');
  }
  return context;
}

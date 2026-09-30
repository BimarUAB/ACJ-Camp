import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const LocationContext = createContext(null);
const LOCATION_PROMPT_KEY = 'acj-camp-location-prompt';

export function LocationProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const storageKey = `${LOCATION_PROMPT_KEY}:${user?.id || 'guest'}`;
  const [position, setPosition] = useState(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptReady, setPromptReady] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    setPromptVisible(localStorage.getItem(storageKey) !== 'handled');
    setPromptReady(true);
  }, [authLoading, storageKey]);

  const markPromptHandled = () => localStorage.setItem(storageKey, 'handled');

  const requestLocation = () => {
    setError('');

    if (!navigator.geolocation) {
      const locationError = new Error('Este dispositivo no permite compartir la ubicación.');
      setError(locationError.message);
      return Promise.reject(locationError);
    }

    setRequesting(true);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const currentPosition = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
          };
          setPosition(currentPosition);
          markPromptHandled();
          setPromptVisible(false);
          setRequesting(false);
          resolve(currentPosition);
        },
        (geolocationError) => {
          const message = geolocationError.code === 1
            ? 'El permiso de ubicación fue denegado. Puedes habilitarlo en la configuración del navegador.'
            : 'No se pudo obtener la ubicación. Intenta nuevamente.';
          const locationError = new Error(message);
          setError(message);
          setRequesting(false);
          reject(locationError);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  const dismissPrompt = () => {
    markPromptHandled();
    setPromptVisible(false);
    setError('');
  };

  return (
    <LocationContext.Provider value={{ position, promptVisible: promptReady && promptVisible, requesting, error, requestLocation, dismissPrompt }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useUserLocation() {
  return useContext(LocationContext);
}
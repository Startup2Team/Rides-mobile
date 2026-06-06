import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  INITIAL_DRIVER_DOCUMENTS,
  type DocFaces,
  type DocumentKey,
} from './onboardingTypes';

export function useDriverDocumentUpload(setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>) {
  const [docs, setDocs] = useState<Record<DocumentKey, DocFaces>>(INITIAL_DRIVER_DOCUMENTS);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  const setDocumentFace = (key: DocumentKey, face: 0 | 1, uri: string) => {
    setDocs(current => {
      const updated: DocFaces = [current[key][0], current[key][1]];
      updated[face] = uri;
      return { ...current, [key]: updated };
    });
    setErrors(current => ({ ...current, [key]: '' }));
  };

  const pickDocument = async (key: DocumentKey, face: 0 | 1) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
    if (!result.canceled && result.assets[0]) setDocumentFace(key, face, result.assets[0].uri);
  };

  const takeDocumentPhoto = async (key: DocumentKey, face: 0 | 1) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to take document photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
    if (!result.canceled && result.assets[0]) setDocumentFace(key, face, result.assets[0].uri);
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access for identity verification.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
      setErrors(current => ({ ...current, selfie: '' }));
    }
  };

  return { docs, pickDocument, selfieUri, takeDocumentPhoto, takeSelfie };
}

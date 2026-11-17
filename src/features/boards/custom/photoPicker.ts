import * as ImagePicker from 'expo-image-picker';

export type PickResult =
  { status: 'picked'; uris: string[] } | { status: 'cancelled' } | { status: 'denied' };

/**
 * Multi-select from the gallery. On Android this is the system photo picker,
 * so the app never needs broad media permissions.
 */
export async function pickFromGallery(limit: number): Promise<PickResult> {
  if (limit <= 0) return { status: 'cancelled' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 1,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'picked', uris: result.assets.slice(0, limit).map((a) => a.uri) };
}

/** Takes a single photo with the camera (asks for camera permission first). */
export async function takePhoto(): Promise<PickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'picked', uris: [result.assets[0]!.uri] };
}

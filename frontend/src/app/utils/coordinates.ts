export interface Coordinates {
  lat: number;
  lng: number;
}

export const parseCoordinates = (value: string): Coordinates | null => {
  const parts = value.split(',');
  if (parts.length !== 2) return null;

  const [latitude, longitude] = parts.map((part) => part.trim());
  const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!numberPattern.test(latitude!) || !numberPattern.test(longitude!)) return null;

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;

  return { lat, lng };
};

export const formatCoordinates = ({ lat, lng }: Coordinates): string =>
  `${lat.toFixed(8)}, ${lng.toFixed(8)}`;

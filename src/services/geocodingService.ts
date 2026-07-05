export class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingError';
  }
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Geocode an address using Google Geocoding API v4.
 * Uses geocode.googleapis.com/v4/geocode/address endpoint with X-Goog-Api-Key header.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const config = (await import('../config.js')).config;

  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new GeocodingError('GOOGLE_MAPS_API_KEY tidak dikonfigurasi');
  }

  // v4 endpoint: address goes in URL path
  const encodedAddress = encodeURIComponent(address);
  const url = `https://geocode.googleapis.com/v4/geocode/address/${encodedAddress}`;

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': config.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'results.location,results.formattedAddress',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new GeocodingError(
      `Geocoding gagal (HTTP ${response.status})${errorBody ? ': ' + errorBody : ''}`
    );
  }

  const data = await response.json() as {
    results?: Array<{
      location?: { latitude: number; longitude: number };
      formattedAddress?: string;
    }>;
  };

  if (!data.results || data.results.length === 0) {
    throw new GeocodingError(`Geocoding gagal: tidak ada hasil untuk alamat "${address}"`);
  }

  const result = data.results[0];
  if (!result.location) {
    throw new GeocodingError(`Geocoding gagal: lokasi tidak ditemukan untuk alamat "${address}"`);
  }

  return {
    lat: result.location.latitude,
    lng: result.location.longitude,
    formattedAddress: result.formattedAddress || address,
  };
}

export interface Photo {
  id: string;
  filename: string;
  w: number;
  h: number;
  order: number;
  visible: boolean;
  capturedAt?: string;
  // Optional description
  description?: string;
  // EXIF metadata
  camera?: string;
  lens?: string;
  aperture?: string;     // ex: "f/1.8"
  shutterSpeed?: string; // ex: "1/500s"
  iso?: number;
  focalLength?: string;  // ex: "35mm"
  // Geolocation
  location?: string;     // ex: "Shinjuku, Tokyo"
  geoLat?: number;
  geoLng?: number;
}

export type AlbumSortOrder = 'date-asc' | 'date-desc' | 'custom';

export interface Album {
  slug: string;
  title: string;
  description?: string;
  visible: boolean;
  cover: string;
  photos: Photo[];
  createdAt: string;
  sortOrder?: AlbumSortOrder;
}

export interface AlbumSummary {
  slug: string;
  title: string;
  visible: boolean;
  cover: string;
  /** Pre-computed thumb CDN URL for the cover photo (stored at write time in putAlbum). */
  coverUrl?: string;
  /** Pre-computed full CDN URL for the cover photo — used as onerror fallback. */
  coverFullUrl?: string;
  photoCount: number;
  createdAt: string;
}

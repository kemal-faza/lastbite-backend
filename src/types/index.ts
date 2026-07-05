export interface UserResponse {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  isVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: UserResponse;
}

export interface ApiError {
  error: string;
  code: string;
}

export interface ProductResponse {
  id: string;
  name: string;
  description: string | null;
  category: string;
  originalPrice: number;
  discountedPrice: number;
  /** Computed: Math.round(((originalPrice - discountedPrice) / originalPrice) * 100) */
  discountPercent: number;
  stock: number;
  imageUrl: string | null;
  storeName: string;
  storeAddress: string | null;
  storeLat: number | null;
  storeLng: number | null;
  distanceKm?: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse {
  products: ProductResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductListResponse extends PaginatedResponse {
  totalPages: number;
}

export interface ProductSearchResponse extends PaginatedResponse {
  query: string;
}

export interface MitraProfileResponse {
  id: string;
  userId: string;
  storeName: string;
  storeDescription: string | null;
  storeAddress: string | null;
  storeLat: number | null;
  storeLng: number | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface MitraStatsResponse {
  totalStock: number;
  totalSold: number;
  remaining: number;
  productCount: number;
  activeOrders: number;
}

export interface SalesTrendEntry {
  date: string;
  totalOrders: number;
  totalItems: number;
  totalRevenue: number;
  totalSavings: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalSavings: number;
  totalOrders: number;
  totalItems: number;
  averageOrderValue: number;
}

export interface ProductPerformanceEntry {
  productId: string;
  productName: string;
  category: string;
  totalSold: number;
  totalRevenue: number;
  averageRating: number;
}

export interface PeakHourEntry {
  hour: number;
  label: string;
  orders: number;
  items: number;
  revenue: number;
}

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  priceFormatted: string;
  currency: string;
  durationDays: number;
  maxDevices: number;
  features: unknown;
  availableDurations: Array<{ days: number; price: number; label?: string }>;
}

export interface License {
  id: string;
  name: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED' | 'PENDING';
  plan: { id: string; name: string; slug: string; maxDevices: number };
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  keyMasked: string;
  keyLastFour: string;
  maxDevices: number;
  activeDevices: number;
}

export interface LicenseDevice {
  id: string;
  deviceName: string | null;
  platform: string | null;
  appVersion: string | null;
  status: 'ACTIVE' | 'UNBOUND';
  boundAt: string;
  lastSeenAt: string;
  unboundAt: string | null;
  hwidMasked: string;
}

export type NotificationCategory =
  | 'ACCOUNT' | 'SUBSCRIPTION' | 'LICENSE' | 'DEVICE'
  | 'PAYMENT' | 'TOOL_UPDATE' | 'SYSTEM';

export interface AppNotification {
  id: string;
  userId: string | null;
  title: string;
  body: string;
  category: NotificationCategory;
  link: string | null;
  publishedAt: string;
  readAt: string | null;
}

export interface NotificationList {
  items: AppNotification[];
  page: number;
  limit: number;
  total: number;
  unread: number;
}

export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  requiredPlan: { name: string; slug: string } | null;
  minAppVersion: string | null;
  latestRelease: { version: string; releasedAt: string; fileSize: number } | null;
  isActive: boolean;
  updatedAt: string;
}

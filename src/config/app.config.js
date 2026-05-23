/**
 * Application Configuration
 * Centralized configuration for the entire application
 */

export const APP_CONFIG = {
  // API Configuration
  API: {
    BASE_URL: import.meta.env.VITE_API_URL || "",
    TIMEOUT_MS: Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000),
  },

  // Polling Intervals (in milliseconds)
  POLLING: {
    RIDE_STATUS: 3000,           // Poll ride status every 3 seconds
    DRIVER_LOCATION: 5000,       // Update driver location every 5 seconds
    INCOMING_REQUESTS: 2000,     // Check for incoming ride requests every 2 seconds
    WALLET_BALANCE: 10000,       // Refresh wallet balance every 10 seconds
  },

  // File Upload Constraints
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024,  // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png'],
    ALLOWED_DOCUMENT_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  },

  // Map Configuration
  MAP: {
    DEFAULT_CENTER: [28.6139, 77.2090],  // Delhi, India
    DEFAULT_ZOOM: 13,
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    RIDES_PAGE_SIZE: 15,
    ADMIN_PAGE_SIZE: 20,
  },

  // Toast/Notification Duration
  TOAST: {
    SUCCESS_DURATION: 3000,
    ERROR_DURATION: 5000,
    INFO_DURATION: 4000,
  },

  // Storage Keys
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_DATA: 'userData',
    THEME: 'theme',
  },

  // Feature Flags
  FEATURES: {
    ENABLE_WALLET: true,
    ENABLE_RATINGS: true,
    ENABLE_SUPPORT: true,
    ENABLE_OTP_VERIFICATION: true,
  },
};

export default APP_CONFIG;

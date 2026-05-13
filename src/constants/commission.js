/**
 * BookCar Platform Commission Constants
 *
 * IMPORTANT: Keep in sync with the backend value:
 * PaymentStrategy.java → PLATFORM_COMMISSION = 0.3 (30%)
 *
 * The backend credits the driver wallet with: fare * DRIVER_SHARE
 * The frontend must display the same value consistently.
 */

/** Platform commission rate: 30% goes to BookCar */
export const PLATFORM_COMMISSION_RATE = 0.30;

/** Driver's share after platform commission: 70% */
export const DRIVER_SHARE = 1 - PLATFORM_COMMISSION_RATE;

/**
 * Returns the driver's net earnings for a given ride fare.
 * Mirrors the backend formula: payment.getAmount() * (1 - PLATFORM_COMMISSION)
 */
export const getDriverEarnings = (fare) =>
  typeof fare === 'number' && fare > 0
    ? Number((fare * DRIVER_SHARE).toFixed(2))
    : 0;

/**
 * Returns a human-readable commission label shown to drivers.
 * e.g. "after 30% platform fee"
 */
export const commissionLabel = `after ${Math.round(PLATFORM_COMMISSION_RATE * 100)}% platform fee`;

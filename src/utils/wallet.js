const pickFirstFiniteNumber = (values = []) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

export const getWalletBalance = (wallet) => {
  if (!wallet) return 0;

  return pickFirstFiniteNumber([
    wallet.balance,
    wallet.walletBalance,
    wallet.amount,
    wallet.currentBalance,
    wallet.availableBalance,
    wallet?.wallet?.balance,
    wallet?.wallet?.walletBalance,
    wallet?.data?.balance,
    wallet?.data?.walletBalance,
    wallet?.data?.amount,
  ]);
};

export const getWalletTransactions = (wallet) =>
  wallet?.transactions ||
  wallet?.transactionHistory ||
  wallet?.walletTransactions ||
  wallet?.data?.transactions ||
  wallet?.data?.transactionHistory ||
  [];

export const normalizeWallet = (wallet, fallback = {}) => ({
  ...fallback,
  ...wallet,
  balance: getWalletBalance(wallet ?? fallback),
  transactions: getWalletTransactions(wallet ?? fallback),
});

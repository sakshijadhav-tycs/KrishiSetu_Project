import Deal from "../models/DealModel.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const computeDealPrice = ({ originalPrice, discountType, discountValue }) => {
  const base = Number(originalPrice || 0);
  const value = Number(discountValue || 0);
  if (!Number.isFinite(base) || base <= 0) return null;
  if (!Number.isFinite(value) || value < 0) return null;

  if (discountType === "percentage") {
    if (value <= 0 || value >= 100) return null;
    const discountedPrice = round2(base - (base * value) / 100);
    return discountedPrice > 0 ? discountedPrice : null;
  }

  if (discountType === "fixedPrice") {
    if (value <= 0 || value >= base) return null;
    return round2(value);
  }

  return null;
};

export const validateDealInput = ({ productPrice, discountType, discountValue, startDate, endDate }) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Invalid start/end date";
  }
  if (end < start) {
    return "End date cannot be before start date";
  }

  const discountedPrice = computeDealPrice({
    originalPrice: productPrice,
    discountType,
    discountValue,
  });
  if (discountedPrice === null) {
    return "Invalid discount. Ensure percentage is between 0-100 or fixed price is less than original price";
  }
  return null;
};

export const getActiveDealsByProductIds = async (productIds = [], now = new Date()) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }
  const deals = await Deal.find({
    productId: { $in: productIds },
    isEnabled: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ createdAt: -1 })
    .lean();

  const map = new Map();
  for (const deal of deals) {
    const key = String(deal.productId);
    if (!map.has(key)) map.set(key, deal);
  }
  return map;
};

export const getAppliedDealForProduct = async (product, now = new Date()) => {
  if (!product?._id) return null;
  const deal = await Deal.findOne({
    productId: product._id,
    isEnabled: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!deal) return null;

  const discountedPrice = computeDealPrice({
    originalPrice: product.price,
    discountType: deal.discountType,
    discountValue: deal.discountValue,
  });
  if (discountedPrice === null) return null;

  return {
    ...deal,
    originalPrice: Number(product.price),
    discountedPrice,
  };
};

export const attachPricingSnapshot = (productLike, deal) => {
  if (!productLike) return productLike;
  const originalPrice = Number(productLike.price || 0);
  if (!deal) {
    return {
      ...productLike,
      pricing: {
        originalPrice,
        finalPrice: originalPrice,
        hasDeal: false,
      },
    };
  }

  const discountedPrice = computeDealPrice({
    originalPrice,
    discountType: deal.discountType,
    discountValue: deal.discountValue,
  });
  if (discountedPrice === null) {
    return {
      ...productLike,
      pricing: {
        originalPrice,
        finalPrice: originalPrice,
        hasDeal: false,
      },
    };
  }

  return {
    ...productLike,
    activeDeal: {
      _id: deal._id,
      discountType: deal.discountType,
      discountValue: deal.discountValue,
      startDate: deal.startDate,
      endDate: deal.endDate,
      badge: "🔥 Limited Time Deal",
      originalPrice,
      discountedPrice,
    },
    pricing: {
      originalPrice,
      finalPrice: discountedPrice,
      hasDeal: true,
    },
  };
};

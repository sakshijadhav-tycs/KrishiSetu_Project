import mongoose from "mongoose";
import Product from "../models/ProductModel.js";
import User from "../models/UserModel.js";
import Review from "../models/ReviewModel.js";
import Order from "../models/OrderModel.js";
import {
  autoReactivateExpiredSuspensions,
  FARMER_ACCOUNT_STATUS,
  getFarmerAccountBlockReason,
  normalizeFarmerAccountStatus,
} from "../utils/accountStatus.js";
import {
  attachPricingSnapshot,
  getActiveDealsByProductIds,
  getAppliedDealForProduct,
} from "../utils/dealPricing.js";

const ensureFarmerCanManageProducts = async (farmerId) => {
  const farmer = await User.findById(farmerId).select(
    "accountStatus role rejectionReason suspensionStartDate suspensionEndDate suspensionReason"
  );
  return getFarmerAccountBlockReason(farmer);
};

// @desc    Create a product
export const createProduct = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const accountState = await ensureFarmerCanManageProducts(farmerId);
    if (accountState.blocked) {
      return res.status(403).json({
        success: false,
        message: accountState.message,
        accountState,
      });
    }

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one image is required" });
    }

    const productData = {
      ...req.body,
      farmer: farmerId,
      images: req.files.map((file) => file.path.replace(/\\/g, "/")),
    };

    const product = await Product.create(productData);
    res
      .status(201)
      .json({ success: true, message: "Product created", data: product });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get all products
export const getAllProducts = async (req, res) => {
  try {
    await autoReactivateExpiredSuspensions();

    const approvedFarmerIds = await User.find({
      role: "farmer",
      accountStatus: { $in: [FARMER_ACCOUNT_STATUS.APPROVED, "approved"] },
    }).distinct("_id");

    const products = await Product.find({
      isActive: true,
      farmer: { $in: approvedFarmerIds },
    })
      .populate("farmer", "name email kyc accountStatus verified_badge verification_status")
      .populate("category", "name");

    if (!products.length) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const farmerIds = [
      ...new Set(
        products
          .map((product) => product?.farmer?._id?.toString?.() || "")
          .filter(Boolean)
      ),
    ];

    const farmerObjectIds = farmerIds.map((id) => new mongoose.Types.ObjectId(id));

    const [reviewStats, orderStats] = await Promise.all([
      Review.aggregate([
        {
          $match: {
            farmerId: { $in: farmerObjectIds },
            isHidden: { $ne: true },
          },
        },
        {
          $group: {
            _id: "$farmerId",
            avgRating: { $avg: "$rating" },
            ratingCount: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { status: { $in: ["completed", "delivered"] } } },
        { $unwind: "$items" },
        {
          $match: {
            "items.farmer": { $in: farmerObjectIds },
          },
        },
        {
          $group: {
            _id: "$items.farmer",
            completedOrders: { $sum: 1 },
            totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          },
        },
      ]),
    ]);

    const reviewMap = new Map(
      reviewStats.map((item) => [
        item._id.toString(),
        {
          avgRating: Number(item.avgRating || 0),
          ratingCount: item.ratingCount || 0,
        },
      ])
    );

    const orderMap = new Map(
      orderStats.map((item) => [
        item._id.toString(),
        {
          completedOrders: item.completedOrders || 0,
          totalRevenue: Number(item.totalRevenue || 0),
        },
      ])
    );

    const productIds = products.map((product) => product._id);
    const activeDealsByProductId = await getActiveDealsByProductIds(productIds);

    const rankedProducts = products
      .map((product) => {
        const farmerId = product?.farmer?._id?.toString?.();
        const ratingInfo = reviewMap.get(farmerId) || { avgRating: 0, ratingCount: 0 };
        const orderInfo = orderMap.get(farmerId) || {
          completedOrders: 0,
          totalRevenue: 0,
        };

        const farmerPerformanceScore =
          ratingInfo.avgRating * 20 + Math.min(orderInfo.completedOrders, 60) + Math.min(orderInfo.totalRevenue / 200, 20);

        const withScore = {
          ...product.toObject(),
          avgRating: Number(ratingInfo.avgRating.toFixed(2)),
          ratingCount: ratingInfo.ratingCount,
          completedOrders: orderInfo.completedOrders,
          totalRevenue: Number(orderInfo.totalRevenue.toFixed(2)),
          farmerPerformanceScore: Number(farmerPerformanceScore.toFixed(2)),
        };
        const deal = activeDealsByProductId.get(String(product._id));
        return attachPricingSnapshot(withScore, deal);
      })
      .sort((a, b) => {
        if (b.farmerPerformanceScore !== a.farmerPerformanceScore) {
          return b.farmerPerformanceScore - a.farmerPerformanceScore;
        }
        if (b.avgRating !== a.avgRating) {
          return b.avgRating - a.avgRating;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    res.json({ success: true, count: rankedProducts.length, data: rankedProducts });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get single product details
export const getProduct = async (req, res) => {
  try {
    await autoReactivateExpiredSuspensions();

    const product = await Product.findById(req.params.id)
      .populate(
        "farmer",
        "name email phone kyc accountStatus rejectionReason suspensionStartDate suspensionEndDate suspensionReason verified_badge verification_status"
      )
      .populate("category", "name");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const farmerStatus = normalizeFarmerAccountStatus(
      product.farmer?.accountStatus
    );
    if (farmerStatus !== FARMER_ACCOUNT_STATUS.APPROVED) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const activeDeal = await getAppliedDealForProduct(product);
    const productWithPricing = attachPricingSnapshot(product.toObject(), activeDeal);

    res.json({ success: true, data: productWithPricing });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Update product
export const updateProduct = async (req, res) => {
  try {
    const accountState = await ensureFarmerCanManageProducts(req.user._id);
    if (accountState.blocked) {
      return res.status(403).json({
        success: false,
        message: accountState.message,
        accountState,
      });
    }

    const { id } = req.params;
    let product = await Product.findById(id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const updateData = { ...req.body };
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map((file) => file.path.replace(/\\/g, "/"));
    }

    product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, message: "Product updated", data: product });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Delete product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, message: "Product removed" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get farmer's own products
export const getFarmerProducts = async (req, res) => {
  try {
    await autoReactivateExpiredSuspensions();
    const products = await Product.find({ farmer: req.user._id }).populate(
      "category",
      "name"
    );
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

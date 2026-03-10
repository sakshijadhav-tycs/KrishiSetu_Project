import mongoose from "mongoose";
import Review from "../models/ReviewModel.js";
import User from "../models/UserModel.js";

// @desc    Add a review
export const addReview = async (req, res) => {
  try {
    const { farmerId, rating, comment } = req.body;

    // Check karein ki user authenticated hai (Middleware se)
    if (!req.user) {
        return res.status(401).json({ success: false, message: "Not authorized" });
    }

    if (req.user.role !== "consumer") {
      return res.status(403).json({
        success: false,
        message: "Only consumers can submit reviews",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid farmer ID",
      });
    }

    const normalizedFarmerId = new mongoose.Types.ObjectId(farmerId);

    if (req.user._id?.toString() === normalizedFarmerId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot review your own profile",
      });
    }

    const farmer = await User.findOne({
      _id: normalizedFarmerId,
      role: "farmer",
    }).select("_id");

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer not found",
      });
    }

    const reviewPayload = {
      customerName: req.user.name,
      rating: Number(rating),
      comment,
    };

    const existingReview = await Review.findOne({
      farmerId: normalizedFarmerId,
      customerId: req.user._id,
    });

    if (existingReview) {
      existingReview.set(reviewPayload);
      await existingReview.save();
      return res.status(200).json({
        success: true,
        message: "Review updated successfully",
      });
    }

    const review = new Review({
      farmerId: normalizedFarmerId,
      customerId: req.user._id,
      ...reviewPayload,
    });

    await review.save();
    res.status(201).json({ success: true, message: "Review added successfully" });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this farmer",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reviews for a specific farmer
export const getFarmerReviews = async (req, res) => {
  try {
    const { farmerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid farmer ID",
      });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const requestedLimit = Number(req.query.limit);
    const hasPagination = Number.isFinite(requestedLimit) && requestedLimit > 0;
    const limit = hasPagination ? Math.min(requestedLimit, 50) : null;
    const skip = hasPagination ? (page - 1) * limit : 0;
    const filter = {
      farmerId: new mongoose.Types.ObjectId(farmerId),
      isHidden: false,
    };

    const [reviews, totalReviews] = await Promise.all([
      Review.find(filter)
        .sort("-createdAt")
        .skip(skip)
        .limit(limit || 0),
      Review.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: reviews,
      page,
      limit: limit || totalReviews,
      totalReviews,
      totalPages: hasPagination ? Math.ceil(totalReviews / limit) || 1 : 1,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get rating summary for a specific farmer
export const getFarmerRatingSummary = async (req, res) => {
  try {
    const { farmerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid farmer ID",
      });
    }

    const [summary] = await Review.aggregate([
      {
        $match: {
          farmerId: new mongoose.Types.ObjectId(farmerId),
          isHidden: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$farmerId",
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      avgRating: Number((summary?.avgRating || 0).toFixed(1)),
      totalReviews: summary?.totalReviews || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

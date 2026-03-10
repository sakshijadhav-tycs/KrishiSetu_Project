import Review from "../models/ReviewModel.js";
import User from "../models/UserModel.js";
import { logAdminAction } from "../middleware/activityLogger.js";

// GET /api/admin/reviews
export const getAllReviewsForAdmin = async (req, res) => {
  try {
    const { farmerId } = req.query;
    const filter = {};
    if (farmerId) {
      filter.farmerId = farmerId;
    }

    const reviews = await Review.find(filter)
      .populate("farmerId", "name email")
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error("Admin get reviews error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load reviews" });
  }
};

// DELETE /api/admin/reviews/:id (soft delete via isHidden)
export const hideReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    review.isHidden = true;
    await review.save();

    await logAdminAction({
      req,
      action: "HIDE_REVIEW",
      resourceType: "review",
      resourceId: review._id,
      description: "Review marked as inappropriate and hidden",
    });

    return res.json({
      success: true,
      message: "Review hidden successfully",
      data: review,
    });
  } catch (error) {
    console.error("Admin hide review error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to hide review" });
  }
};

// GET /api/admin/farmers/low-rated
export const getLowRatedFarmers = async (req, res) => {
  try {
    const threshold = Number(req.query.threshold) || 3;

    const aggregation = await Review.aggregate([
      { $match: { isHidden: false } },
      {
        $group: {
          _id: "$farmerId",
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $match: {
          avgRating: { $lt: threshold },
        },
      },
      { $sort: { avgRating: 1 } },
      { $limit: 20 },
    ]);

    const farmerIds = aggregation.map((a) => a._id);
    const farmers = await User.find({ _id: { $in: farmerIds } }).select(
      "name email"
    );
    const farmerMap = new Map(farmers.map((f) => [String(f._id), f]));

    const result = aggregation.map((a) => ({
      farmer: farmerMap.get(String(a._id)) || null,
      avgRating: a.avgRating,
      totalReviews: a.totalReviews,
    }));

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Admin low-rated farmers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load low-rated farmers",
    });
  }
};


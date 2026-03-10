import Product from "../models/ProductModel.js";
import { logAdminAction } from "../middleware/activityLogger.js";

// GET /api/admin/products
export const getAllProductsForAdmin = async (req, res) => {
  try {
    const products = await Product.find({})
      .populate("farmer", "name email")
      .populate("category", "name")
      .lean();

    const now = new Date();
    const groupedByFarmerAndName = new Map();

    products.forEach((p) => {
      const key = `${p.farmer?._id || "unknown"}::${p.name.toLowerCase()}`;
      const list = groupedByFarmerAndName.get(key) || [];
      list.push(p._id.toString());
      groupedByFarmerAndName.set(key, list);
    });

    const duplicateIds = new Set(
      Array.from(groupedByFarmerAndName.values())
        .filter((ids) => ids.length > 1)
        .flat()
    );

    const enriched = products.map((p) => ({
      ...p,
      flags: {
        isExpired: !!p.availableUntil && p.availableUntil < now,
        isDuplicate: duplicateIds.has(p._id.toString()),
        isInactive: p.isActive === false,
      },
    }));

    return res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("Admin get products error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load products" });
  }
};

// PATCH /api/admin/products/:id/hide
export const hideProductAsInappropriate = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    product.isActive = false;
    await product.save();

    await logAdminAction({
      req,
      action: "HIDE_PRODUCT",
      resourceType: "product",
      resourceId: product._id,
      description: "Product marked as inappropriate and deactivated",
    });

    return res.json({
      success: true,
      message: "Product marked as inactive",
      data: product,
    });
  } catch (error) {
    console.error("Admin hide product error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update product" });
  }
};


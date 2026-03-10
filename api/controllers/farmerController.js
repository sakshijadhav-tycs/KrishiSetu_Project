import Order from "../models/OrderModel.js";
import Product from "../models/ProductModel.js";
import User from "../models/UserModel.js";
import {
  autoReactivateExpiredSuspensions,
  getFarmerAccountBlockReason,
} from "../utils/accountStatus.js";

// @desc    Get Farmer Dashboard Stats
export const getFarmerDashboard = async (req, res) => {
  try {
    await autoReactivateExpiredSuspensions();
    const farmerId = req.user._id;
    const farmer = await User.findById(farmerId).select(
      "accountStatus rejectionReason suspensionStartDate suspensionEndDate suspensionReason"
    );
    const accountState = getFarmerAccountBlockReason(farmer);

    // 1. Orders fetch karein aur details populate karein
    const orders = await Order.find({ "items.farmer": farmerId })
      .populate("consumer", "name email")
      .populate("items.product", "name image")
      .sort({ createdAt: -1 });

    // 2. Revenue Calculation Logic (Strict Type Casting)
    const totalRevenue = orders
      .filter(order => order.paymentStatus === "paid") // Sirf Paid orders
      .reduce((acc, order) => {
        // Sirf is farmer ke products ka total nikalna
        const farmerItemsTotal = order.items
          .filter(item => item.farmer && item.farmer.toString() === farmerId.toString())
          .reduce((sum, item) => {
            // Number() ka use ensure karta hai ki string calculation na ho
            const itemPrice = Number(item.price) || 0;
            const itemQty = Number(item.quantity || item.qty) || 0;
            return sum + (itemPrice * itemQty);
          }, 0);
        return acc + farmerItemsTotal;
      }, 0);

    // 3. Stats Calculation
    const pendingOrdersCount = orders.filter(order => order.status === "pending").length;
    const totalProducts = await Product.countDocuments({ farmer: farmerId });

    res.status(200).json({
      success: true,
      accountState,
      stats: {
        totalRevenue: totalRevenue.toFixed(2), // 2 decimal points tak format
        pendingOrdersCount,
        totalProducts,
        recentOrders: orders.slice(0, 5) // Latest 5 orders dashboard ke liye
      }
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Dashboard Chart Statistics
// @route   GET /api/farmer/dashboard/charts
// @access  Private/Farmer
export const getDashboardChartStats = async (req, res) => {
  try {
    const farmerId = req.user._id;

    // Get orders from last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const orders = await Order.find({
      "items.farmer": farmerId,
      createdAt: { $gte: sixMonthsAgo }
    }).populate("items.product", "name");

    // 1. Sales Trend Data (Last 6 Months)
    const salesByMonth = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      salesByMonth[monthKey] = { revenue: 0, orders: 0 };
    }

    // Aggregate sales data
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const monthKey = `${monthNames[orderDate.getMonth()]} ${orderDate.getFullYear()}`;

      if (salesByMonth[monthKey]) {
        salesByMonth[monthKey].orders += 1;

        if (order.paymentStatus === "paid") {
          const farmerRevenue = order.items
            .filter(item => item.farmer && item.farmer.toString() === farmerId.toString())
            .reduce((sum, item) => {
              const price = Number(item.price) || 0;
              const qty = Number(item.quantity || item.qty) || 0;
              return sum + (price * qty);
            }, 0);

          salesByMonth[monthKey].revenue += farmerRevenue;
        }
      }
    });

    const salesData = Object.keys(salesByMonth).map(month => ({
      month: month.split(' ')[0], // Just month name
      revenue: Math.round(salesByMonth[month].revenue),
      orders: salesByMonth[month].orders
    }));

    // 2. Product Performance (Top 5 Products)
    const productStats = {};

    orders.forEach(order => {
      order.items
        .filter(item => item.farmer && item.farmer.toString() === farmerId.toString())
        .forEach(item => {
          const productName = item.product?.name || 'Unknown';
          if (!productStats[productName]) {
            productStats[productName] = { sold: 0, revenue: 0 };
          }

          const qty = Number(item.quantity || item.qty) || 0;
          const price = Number(item.price) || 0;

          productStats[productName].sold += qty;
          if (order.paymentStatus === "paid") {
            productStats[productName].revenue += (price * qty);
          }
        });
    });

    const productPerformance = Object.keys(productStats)
      .map(name => ({
        name,
        sold: productStats[name].sold,
        revenue: Math.round(productStats[name].revenue)
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 3. Visitor Stats (Last 30 Days) - Mock data for now
    // TODO: Implement actual visitor tracking
    const visitorStats = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Generate realistic visitor data based on orders
      const dayOrders = orders.filter(o => {
        const oDate = new Date(o.createdAt).toISOString().split('T')[0];
        return oDate === dateStr;
      }).length;

      visitorStats.push({
        date: dateStr.slice(5), // MM-DD format
        visits: Math.max(dayOrders * 3, Math.floor(Math.random() * 50) + 20)
      });
    }

    res.status(200).json({
      success: true,
      data: {
        salesData,
        productPerformance,
        visitorStats
      }
    });

  } catch (error) {
    console.error("Chart Stats Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

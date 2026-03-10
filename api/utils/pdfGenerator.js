import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../uploads');
const invoicesDir = path.join(uploadsDir, 'invoices');
const receiptsDir = path.join(uploadsDir, 'receipts');

[uploadsDir, invoicesDir, receiptsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const getEntityId = (entity) => {
  if (!entity) return null;
  if (typeof entity === 'string') return entity;
  return entity._id ? entity._id.toString() : entity.toString();
};

const formatDate = (value) => new Date(value || Date.now()).toLocaleDateString('en-IN');

const COLORS = {
  primary: '#16a34a',
  textDark: '#111827',
  textMuted: '#6b7280',
  accent: '#f9fafb',
  border: '#e5e7eb',
  white: '#ffffff',
};

const generateHeader = (doc, type, idLabel, idValue, orderId, date) => {
  const logoPath = path.join(__dirname, '../assets/logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 45, { width: 40 });
    doc.fillColor(COLORS.primary).fontSize(22).font('Helvetica-Bold').text('KrishiSetu', 95, 52);
  } else {
    doc.fillColor(COLORS.primary).fontSize(24).font('Helvetica-Bold').text('KrishiSetu', 50, 45);
  }

  doc.fillColor(COLORS.textMuted).fontSize(9).font('Helvetica').text('Connecting Farmers to You', 50, 85);
  doc.fillColor(COLORS.textDark).fontSize(16).font('Helvetica-Bold').text(type, 300, 45, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.textMuted);
  doc.text(`${idLabel}: ${idValue}`, 300, 68, { align: 'right' });
  doc.text(`Order ID: #${orderId}`, 300, 80, { align: 'right' });
  doc.text(`Date: ${date}`, 300, 92, { align: 'right' });
  doc.moveTo(50, 115).lineTo(550, 115).strokeColor(COLORS.border).lineWidth(0.5).stroke();
};

const generatePartyAndStatus = (
  doc,
  { partyLabel, partyName, partySecondary, statusText, statusColor, statusSubText }
) => {
  doc.fillColor(COLORS.textDark).fontSize(9).font('Helvetica-Bold').text(`${partyLabel}:`, 50, 140);
  doc.font('Helvetica').fontSize(10).text(partyName || 'Customer', 50, 155);
  doc.fillColor(COLORS.textMuted).fontSize(9).text(partySecondary || '', 50, 168);

  doc.fillColor(COLORS.textDark).font('Helvetica-Bold').text('PAYMENT STATUS:', 350, 140, { align: 'right' });
  doc.fillColor(statusColor).font('Helvetica-Bold').text(statusText, 350, 155, { align: 'right' });

  if (statusSubText) {
    doc.fillColor(COLORS.textMuted).font('Helvetica').fontSize(8).text(statusSubText, 350, 168, { align: 'right' });
  }
};

const generateTable = (doc, startY, items, farmers, totalLabel, totalAmount) => {
  const tableHeaderY = startY;
  doc.rect(50, tableHeaderY, 500, 24).fill(COLORS.accent);

  doc.fillColor(COLORS.textDark).fontSize(8).font('Helvetica-Bold');
  doc.text('SR.', 60, tableHeaderY + 8);
  doc.text('DESCRIPTION / PRODUCT', 90, tableHeaderY + 8);
  doc.text('FARMER', 240, tableHeaderY + 8);
  doc.text('QTY', 360, tableHeaderY + 8, { width: 30, align: 'center' });
  doc.text('PRICE', 400, tableHeaderY + 8, { width: 70, align: 'right' });
  doc.text('TOTAL', 485, tableHeaderY + 8, { width: 60, align: 'right' });

  let currentY = tableHeaderY + 35;
  doc.font('Helvetica').fontSize(9);

  items.forEach((item, index) => {
    const itemFarmerId = getEntityId(item?.farmer);
    const farmer = farmers.find((f) => f._id.toString() === itemFarmerId);
    const farmerName = farmer ? farmer.name : 'Krishi Partner';
    const price = Number(item?.price || 0);
    const qty = Number(item?.quantity || 0);
    const lineTotal = price * qty;
    const productName = item?.product?.name || 'Fresh Produce';

    doc.fillColor(COLORS.textMuted).text(`${index + 1}.`, 60, currentY);
    doc.fillColor(COLORS.textDark).font('Helvetica-Bold').text(productName, 90, currentY, { width: 140 });
    doc.fillColor(COLORS.textMuted).font('Helvetica').text(farmerName, 240, currentY, { width: 110 });
    doc.fillColor(COLORS.textDark).text(qty.toString(), 360, currentY, { width: 30, align: 'center' });
    doc.text(`Rs. ${price.toFixed(2)}`, 400, currentY, { width: 70, align: 'right' });
    doc.font('Helvetica-Bold').text(`Rs. ${lineTotal.toFixed(2)}`, 485, currentY, { width: 60, align: 'right' });

    currentY += 30;
    doc.moveTo(50, currentY - 10).lineTo(550, currentY - 10).strokeColor(COLORS.accent).lineWidth(0.5).stroke();
  });

  const summaryY = currentY + 15;
  doc.rect(340, summaryY, 210, 40).fill(COLORS.primary);
  doc.fillColor(COLORS.white).fontSize(10).font('Helvetica-Bold').text(totalLabel, 355, summaryY + 15);
  doc.fontSize(15).text(`Rs. ${Number(totalAmount || 0).toFixed(2)}`, 440, summaryY + 12, { width: 100, align: 'right' });
};

export const generateInvoicePDF = async (order, consumer, farmers) => {
  return new Promise((resolve, reject) => {
    try {
      const invoiceId = `INV-${order._id.toString().substring(0, 8).toUpperCase()}`;
      const filename = `invoice-${order._id}-${Date.now()}.pdf`;
      const filepath = path.join(invoicesDir, filename);
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      generateHeader(
        doc,
        'INVOICE',
        'Invoice ID',
        invoiceId,
        order._id.toString().toUpperCase(),
        formatDate(order.createdAt)
      );
      generatePartyAndStatus(doc, {
        partyLabel: 'BILL TO',
        partyName: consumer?.name,
        partySecondary: consumer?.email,
        statusText: 'STATUS: PENDING (COD)',
        statusColor: '#dc2626',
        statusSubText: 'Method: Cash on Delivery',
      });
      generateTable(doc, 210, order.items, farmers, 'TOTAL DUE:', order.totalAmount);

      doc.end();
      stream.on('finish', () => resolve(`/uploads/invoices/${filename}`));
    } catch (error) {
      reject(error);
    }
  });
};

export const generateReceiptPDF = async (order, consumer, farmers) => {
  return new Promise((resolve, reject) => {
    try {
      const receiptId = `RCP-${order._id.toString().substring(0, 8).toUpperCase()}`;
      const filename = `receipt-${order._id}-${Date.now()}.pdf`;
      const filepath = path.join(receiptsDir, filename);
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      generateHeader(
        doc,
        'PAYMENT RECEIPT',
        'Receipt ID',
        receiptId,
        order._id.toString().toUpperCase(),
        formatDate(order.updatedAt || order.createdAt)
      );

      const isOnlinePayment = order.paymentMethod === 'razorpay';
      const paymentReference = order.razorpay_payment_id || order.razorpayPaymentId || 'N/A';
      const methodLabel = isOnlinePayment ? 'Razorpay (Online)' : 'Cash on Delivery';

      generatePartyAndStatus(doc, {
        partyLabel: 'PAID BY',
        partyName: consumer?.name,
        partySecondary: consumer?.email,
        statusText: 'STATUS: PAID',
        statusColor: COLORS.primary,
        statusSubText: `Method: ${methodLabel} | Ref: ${paymentReference}`,
      });
      generateTable(doc, 210, order.items, farmers, 'TOTAL PAID:', order.totalAmount);

      doc.end();
      stream.on('finish', () => resolve(`/uploads/receipts/${filename}`));
    } catch (error) {
      reject(error);
    }
  });
};

export const generateTransparentInvoicePDF = async (
  mainOrder,
  customer,
  items = [],
  subOrders = []
) => {
  return new Promise((resolve, reject) => {
    try {
      const invoiceId = `TS-INV-${mainOrder._id.toString().substring(0, 8).toUpperCase()}`;
      const filename = `invoice-transparent-${mainOrder._id}-${Date.now()}.pdf`;
      const filepath = path.join(invoicesDir, filename);
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      generateHeader(
        doc,
        "SPLIT ORDER INVOICE",
        "Invoice ID",
        invoiceId,
        mainOrder._id.toString().toUpperCase(),
        formatDate(mainOrder.createdAt)
      );

      const paymentRef = mainOrder.razorpayPaymentId || "N/A";
      generatePartyAndStatus(doc, {
        partyLabel: "BILL TO",
        partyName: customer?.name || "Customer",
        partySecondary: customer?.email || "",
        statusText: `STATUS: ${(mainOrder.paymentStatus || "pending").toUpperCase()}`,
        statusColor: mainOrder.paymentStatus === "paid" ? COLORS.primary : "#dc2626",
        statusSubText: `Method: Razorpay | Ref: ${paymentRef}`,
      });

      const farmers = subOrders
        .map((s) => ({
          _id: s.farmerId?._id?.toString?.() || s.farmerId?.toString?.(),
          name: s.farmerId?.name || "Farmer",
        }))
        .filter((f) => f._id);

      const normalizedItems = items.map((item) => ({
        product: { name: item.productName || "Product" },
        farmer: item.farmerId,
        quantity: item.quantity,
        price: item.price,
      }));

      generateTable(
        doc,
        210,
        normalizedItems,
        farmers,
        "TOTAL PAID:",
        mainOrder.totalAmount
      );

      doc.font("Helvetica").fontSize(9).fillColor(COLORS.textMuted);
      doc.text(
        `Subtotal: Rs. ${Number(mainOrder.productSubtotal || 0).toFixed(2)}  |  GST: Rs. ${Number(mainOrder.gstAmount || 0).toFixed(2)}  |  Delivery: Rs. ${Number(mainOrder.deliveryCharge || 0).toFixed(2)}`,
        50,
        680
      );
      doc.text(
        `Platform Commission Included: Rs. ${Number(mainOrder.platformCommissionAmount || 0).toFixed(2)}`,
        50,
        695
      );

      doc.end();
      stream.on("finish", () => resolve(`/uploads/invoices/${filename}`));
    } catch (error) {
      reject(error);
    }
  });
};

export const generateTransparentReceiptPDF = async (
  mainOrder,
  customer,
  items = [],
  subOrders = []
) => {
  return new Promise((resolve, reject) => {
    try {
      const receiptId = `TS-RCP-${mainOrder._id.toString().substring(0, 8).toUpperCase()}`;
      const filename = `receipt-transparent-${mainOrder._id}-${Date.now()}.pdf`;
      const filepath = path.join(receiptsDir, filename);
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      generateHeader(
        doc,
        "PAYMENT RECEIPT",
        "Receipt ID",
        receiptId,
        mainOrder._id.toString().toUpperCase(),
        formatDate(mainOrder.updatedAt || mainOrder.createdAt)
      );

      const paymentRef = mainOrder.razorpayPaymentId || "N/A";
      generatePartyAndStatus(doc, {
        partyLabel: "PAID BY",
        partyName: customer?.name || "Customer",
        partySecondary: customer?.email || "",
        statusText: "STATUS: PAID",
        statusColor: COLORS.primary,
        statusSubText: `Method: Razorpay (Online) | Ref: ${paymentRef}`,
      });

      const farmers = subOrders
        .map((s) => ({
          _id: s.farmerId?._id?.toString?.() || s.farmerId?.toString?.(),
          name: s.farmerId?.name || "Farmer",
        }))
        .filter((f) => f._id);

      const normalizedItems = items.map((item) => ({
        product: { name: item.productName || "Product" },
        farmer: item.farmerId,
        quantity: item.quantity,
        price: item.price,
      }));

      generateTable(
        doc,
        210,
        normalizedItems,
        farmers,
        "TOTAL PAID:",
        mainOrder.totalAmount
      );

      doc.font("Helvetica").fontSize(9).fillColor(COLORS.textMuted);
      doc.text(
        `Subtotal: Rs. ${Number(mainOrder.productSubtotal || 0).toFixed(2)}  |  GST: Rs. ${Number(mainOrder.gstAmount || 0).toFixed(2)}  |  Delivery: Rs. ${Number(mainOrder.deliveryCharge || 0).toFixed(2)}`,
        50,
        680
      );
      doc.text(
        `Platform Commission Included: Rs. ${Number(mainOrder.platformCommissionAmount || 0).toFixed(2)}`,
        50,
        695
      );

      doc.end();
      stream.on("finish", () => resolve(`/uploads/receipts/${filename}`));
    } catch (error) {
      reject(error);
    }
  });
};

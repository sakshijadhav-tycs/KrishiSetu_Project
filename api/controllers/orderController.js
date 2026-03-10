import * as orderService from "../services/orderService.js";

export const createOrder = async (req, res) => orderService.createOrder(req, res);

export const verifyPayment = async (req, res) => orderService.verifyPayment(req, res);

export const getOrder = async (req, res) => orderService.getOrder(req, res);

export const getConsumerOrders = async (req, res) => orderService.getConsumerOrders(req, res);

export const getFarmerOrders = async (req, res) => orderService.getFarmerOrders(req, res);

export const getAllOrders = async (req, res) => orderService.getAllOrders(req, res);

export const updateOrderStatus = async (req, res) => orderService.updateOrderStatus(req, res);

export const cancelOrder = async (req, res) => orderService.cancelOrder(req, res);

export const cancelOrderByFarmer = async (req, res) => orderService.cancelOrderByFarmer(req, res);

export const downloadInvoice = async (req, res) => orderService.downloadInvoice(req, res);

export const downloadReceipt = async (req, res) => orderService.downloadReceipt(req, res);

export const confirmCODPayment = async (req, res) => orderService.confirmCODPayment(req, res);

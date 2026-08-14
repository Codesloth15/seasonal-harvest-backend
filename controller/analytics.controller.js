import * as AnalyticsService from "../services/analytics.service.js";

export const getDashboard = async (req, res, next) => {
  try {
    const analytics = await AnalyticsService.getDashboardAnalytics(req.query, req.accessToken);
    res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const result = await AnalyticsService.getDashboardTransactions(req.query, req.accessToken);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

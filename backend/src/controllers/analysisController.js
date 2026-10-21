/**
 * Analysis Controller
 *
 * Lists, reads and deletes the caller's stored analyses (written by the AI
 * analysis service). An analysis belongs to the account in its `user` field;
 * another account's analysis answers as not found.
 *
 * Creating analyses here was retired (16.67): it wrote fields the model does not
 * have, so every save failed, then asked the ML service for an endpoint it does
 * not have, and would have left the record "processing" for ever. The routes
 * that called it answer 501 and name the scan routes that work.
 */

const mongoose = require('mongoose');
const Analysis = require('../models/Analysis');

const TYPES = ['url', 'file', 'network', 'email', 'domain', 'ip', 'hash'];
const STATUSES = ['pending', 'processing', 'completed', 'failed'];
const SORTABLE = ['createdAt', 'updatedAt', 'status', 'type'];

/** The caller's analysis with this ID (its `analysisId`, or its database ID). */
function ownedAnalysisFilter(userId, id) {
  const value = String(id || '');
  const byId = mongoose.isValidObjectId(value) ? [{ _id: value }, { analysisId: value }] : [{ analysisId: value }];
  return { user: userId, $or: byId };
}

function present(analysis) {
  return {
    id: analysis._id,
    analysisId: analysis.analysisId,
    type: analysis.type,
    target: analysis.target?.value,
    status: analysis.status,
    source: analysis.source,
    results: analysis.results,
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
    completedAt: analysis.processing?.completed_at
  };
}

class AnalysisController {
  /**
   * The caller's analyses, newest first, with optional `status` and `type`
   * (`analysisType` is accepted as its earlier name) filters.
   */
  async getUserAnalyses(req, res) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const query = { user: req.user.userId };
      if (STATUSES.includes(req.query.status)) query.status = req.query.status;
      const type = req.query.type || req.query.analysisType;
      if (TYPES.includes(type)) query.type = type;
      const sortBy = SORTABLE.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
      const sort = { [sortBy]: req.query.sortOrder === 'asc' ? 1 : -1 };

      const [analyses, totalCount] = await Promise.all([
        Analysis.find(query).sort(sort).skip((page - 1) * limit).limit(limit),
        Analysis.countDocuments(query)
      ]);
      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        success: true,
        data: {
          analyses: analyses.map(present),
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get user analyses error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /** One of the caller's analyses. */
  async getAnalysis(req, res) {
    try {
      const analysis = await Analysis.findOne(ownedAnalysisFilter(req.user.userId, req.params.analysisId));
      if (!analysis) {
        return res.status(404).json({ success: false, message: 'Analysis not found' });
      }
      res.json({ success: true, data: { analysis: present(analysis) } });
    } catch (error) {
      console.error('Get analysis error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /** Delete one of the caller's analyses. */
  async deleteAnalysis(req, res) {
    try {
      const analysis = await Analysis.findOneAndDelete(ownedAnalysisFilter(req.user.userId, req.params.analysisId));
      if (!analysis) {
        return res.status(404).json({ success: false, message: 'Analysis not found' });
      }
      res.json({ success: true, message: 'Analysis deleted successfully' });
    } catch (error) {
      console.error('Delete analysis error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = new AnalysisController();
module.exports.ownedAnalysisFilter = ownedAnalysisFilter;

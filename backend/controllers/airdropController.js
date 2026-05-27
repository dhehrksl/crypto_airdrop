const Airdrop = require('../models/Airdrop');
const logger = require('../src/lib/logger');

const getAirdrops = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const requested = parseInt(req.query.limit);
    const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 100, 200);
    const sort = req.query.sort || 'latest';
    const skip = (page - 1) * limit;

    let sortQuery = { created_at: -1 };
    if (sort === 'ending_soon') sortQuery = { end_date: 1 };
    else if (sort === 'trend_score') sortQuery = { trend_score: -1 };

    const filterQuery = {
      $and: [
        { $or: [{ is_airdrop: true }, { is_airdrop: { $exists: false } }] },
        { is_scam: false },
        { is_confirmed: true },
        { trend_score: { $gte: 50 } },
        { $or: [
            { end_date: { $gte: new Date() } },
            { end_date: { $exists: false } },
            { end_date: null }
          ]
        }
      ]
    };
    const airdrops = await Airdrop.find(filterQuery).sort(sortQuery).skip(skip).limit(limit);
    res.json({ data: airdrops, page, limit });
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'fetch airdrops failed');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getAirdropById = async (req, res) => {
  try {
    const item = await Airdrop.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'fetch airdrop detail failed');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getAirdrops,
  getAirdropById,
};

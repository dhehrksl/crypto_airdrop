const Airdrop = require('../models/Airdrop');
const News = require('../models/News');

const getAirdrops = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const type = req.query.type || 'airdrops';
    // type별로 다른 기본 limit: 뉴스는 최대 50개 표시 정책, 에어드랍/캘린더는 더 큰 수량 허용
    const defaultLimit = type === 'news' ? 50 : 100;
    const requested = parseInt(req.query.limit);
    const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : defaultLimit, 200);
    const sort = req.query.sort || 'latest';
    const skip = (page - 1) * limit;

    if (type === 'news') {
      const news = await News.find({})
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);
      return res.json({ data: news, page, limit });
    }

    let sortQuery = { created_at: -1 };
    if (sort === 'ending_soon') sortQuery = { end_date: 1 };
    else if (sort === 'trend_score') sortQuery = { trend_score: -1 };

    const filterQuery = {
      $and: [
        { $or: [{ is_airdrop: true }, { is_airdrop: { $exists: false } }] },
        { is_scam: false },
        { trend_score: { $gte: 20 } },
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
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getAirdropById = async (req, res) => {
  try {
    let item = await Airdrop.findById(req.params.id);
    if (!item) item = await News.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    console.error('Error fetching detail:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getAirdrops,
  getAirdropById,
};

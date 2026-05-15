const axios = require('axios');

// CoinGecko API base URL and options
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
// Note: CoinGecko has rate limits. For production, consider their paid API or implementing robust caching.

const getPriceData = async (req, res) => {
  const { coinId, vsCurrency = 'usd', include24hrChange = 'true' } = req.query;

  if (!coinId) {
    return res.status(400).json({ msg: 'coinId is required' });
  }

  try {
    // Making a request to CoinGecko's simple price API
    const response = await axios.get(
      `${COINGECKO_API_BASE}/simple/price`,
      {
        params: {
          ids: coinId,
          vs_currencies: vsCurrency,
          include_24hr_change: include24hrChange,
        },
      }
    );

    // CoinGecko API returns data keyed by coinId
    if (response.data && response.data[coinId]) {
      res.json(response.data[coinId]);
    } else {
      res.status(404).json({ msg: `Price data not found for ${coinId}` });
    }
  } catch (error) {
    console.error('Error fetching from CoinGecko:', error.message);
    res.status(500).json({ msg: 'Failed to fetch price data from external API' });
  }
};

module.exports = {
  getPriceData,
};

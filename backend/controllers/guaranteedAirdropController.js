const GuaranteedAirdrop = require('../models/GuaranteedAirdrop');

const getAllGuaranteedAirdrops = async (req, res) => {
  try {
    const airdrops = await GuaranteedAirdrop.find().sort({ createdAt: -1 });
    res.json({ data: airdrops });
  } catch (error) {
    console.error('Error fetching guaranteed airdrops:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getGuaranteedAirdropById = async (req, res) => {
  try {
    const airdrop = await GuaranteedAirdrop.findById(req.params.id);
    if (!airdrop) {
      return res.status(404).json({ error: 'Guaranteed airdrop not found' });
    }
    res.json(airdrop);
  } catch (error) {
    console.error('Error fetching guaranteed airdrop by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getAllGuaranteedAirdrops,
  getGuaranteedAirdropById,
};

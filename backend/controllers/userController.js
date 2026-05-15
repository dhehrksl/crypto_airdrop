const Airdrop = require('../models/Airdrop');
const GuaranteedAirdrop = require('../models/GuaranteedAirdrop');

// @desc    Mark an airdrop as participated by the user
// @route   POST /api/user/airdrops/:id/participate
const markAsParticipated = async (req, res) => {
  try {
    const userId = req.user.id;
    const airdropId = req.params.id;

    // Try to find in both collections
    let airdrop = await Airdrop.findById(airdropId);
    if (!airdrop) {
      airdrop = await GuaranteedAirdrop.findById(airdropId);
    }
    
    if (!airdrop) {
      return res.status(404).json({ msg: 'Airdrop not found' });
    }

    if (airdrop.participatedBy.includes(userId)) {
      return res.status(400).json({ msg: 'Already marked as participated' });
    }

    airdrop.participatedBy.push(userId);
    await airdrop.save();

    res.json(airdrop);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Unmark an airdrop as participated
// @route   DELETE /api/user/airdrops/:id/participate
const unmarkAsParticipated = async (req, res) => {
  try {
    const userId = req.user.id;
    const airdropId = req.params.id;

    let airdrop = await Airdrop.findById(airdropId);
    if (!airdrop) {
      airdrop = await GuaranteedAirdrop.findById(airdropId);
    }

    if (!airdrop) {
      return res.status(404).json({ msg: 'Airdrop not found' });
    }

    // Remove the user ID from the participatedBy array
    airdrop.participatedBy = airdrop.participatedBy.filter(
      (id) => id.toString() !== userId
    );

    await airdrop.save();

    res.json(airdrop);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Get all airdrops participated by the user
// @route   GET /api/user/airdrops/participated
const getParticipatedAirdrops = async (req, res) => {
  try {
    const userId = req.user.id;

    const participatedAirdrops = await Airdrop.find({ participatedBy: userId }).sort({ createdAt: -1 });
    const participatedGuaranteed = await GuaranteedAirdrop.find({ participatedBy: userId }).sort({ createdAt: -1 });

    const allParticipated = [...participatedAirdrops, ...participatedGuaranteed];
    
    // Optional: sort combined results if needed, though they are already sorted individually
    allParticipated.sort((a, b) => b.createdAt - a.createdAt);

    res.json({ data: allParticipated });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
};


module.exports = {
  markAsParticipated,
  unmarkAsParticipated,
  getParticipatedAirdrops,
};

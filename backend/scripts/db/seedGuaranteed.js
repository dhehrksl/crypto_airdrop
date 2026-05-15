require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const GuaranteedAirdrop = require('../../models/GuaranteedAirdrop');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

const sampleAirdrops = [
  {
    projectName: 'ZkSync',
    tokenTicker: 'zksync',
    category: 'Layer1/Layer2',
    chain: 'Ethereum',
    description: 'A ZK rollup, a Layer-2 scaling solution on Ethereum that offers cheaper and faster transactions. Interacting with the ecosystem is highly likely to result in an airdrop.',
    tasks: [
      '1. Bridge funds to zkSync Era via the official bridge (bridge.zksync.io).',
      '2. Make swaps on a native DEX like ZigZag or Mute.io.',
      '3. Mint an NFT on a zkSync-native marketplace.',
      '4. Interact with various dApps in the ecosystem regularly.'
    ],
    guideUrl: 'https://www.coingecko.com/learn/zksync-airdrop-guide',
    difficulty: 'Medium',
  },
  {
    projectName: 'LayerZero',
    tokenTicker: 'layerzero',
    category: 'Bridge',
    chain: 'Multiple',
    description: 'An omnichain interoperability protocol that allows dApps to build across multiple blockchains. A token has been confirmed and usage will likely be rewarded.',
    tasks: [
      '1. Use the Stargate bridge (stargate.finance) to transfer assets between supported chains.',
      '2. Use the LayerZero testnet bridge (usdcdemo.layerzero.network).',
      '3. Vote on Stargate DAO proposals.',
      '4. Use other dApps built on LayerZero, like Radiant Capital or Angle Protocol.'
    ],
    guideUrl: 'https://airdrops.io/layerzero/',
    difficulty: 'Medium',
  },
  {
    projectName: 'MetaMask',
    category: 'Other',
    chain: 'Ethereum',
    description: 'The most popular crypto wallet. A token has been speculated for years. Using the in-wallet Swap and Bridge features may be criteria for a potential airdrop.',
    tasks: [
      '1. Regularly use the "Swap" feature inside the MetaMask wallet.',
      '2. Use the "Bridge" feature within MetaMask Portfolio.',
      '3. Interact with a variety of dApps using your MetaMask wallet.'
    ],
    guideUrl: 'https://coinmarketcap.com/alexandria/article/a-guide-to-the-potential-metamask-airdrop',
    difficulty: 'Easy',
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB Connected for seeding...');

    await GuaranteedAirdrop.deleteMany({});
    console.log('Cleared existing guaranteed airdrops.');

    await GuaranteedAirdrop.insertMany(sampleAirdrops);
    console.log('Sample guaranteed airdrops have been inserted!');
    
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

seedDB();

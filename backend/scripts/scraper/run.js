const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { runScraper } = require('../../src/services/scraper');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    await runScraper();

    console.log('Job finished successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

main();


// node run_scraper.js                
// ◇ injected env (3) from .env // tip: ⌁ auth for agents [www.vestauth.com]
// Connecting to MongoDB...
// Connected.
// --- Starting Production Scraper Service ---
// [Skip Source] CryptoPanic: Fetch/Parse Error
// [Skip Source] CryptoNews: Fetch/Parse Error
// Analyzing: Citrea Airdrop Registration Official — How to Claim $CTR Token Early (Score: 42)...
// Gemini API Error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.
// Filtered: Citrea Airdrop Registration Official — How to Claim $CTR Token Early (Airdrop: undefined, Scam: undefined, Score: undefined)
// Analyzing: Dango: New L1 for Trading [Confirmed Airdrop] (Score: 32)...
// Gemini API Error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.
// Filtered: Dango: New L1 for Trading [Confirmed Airdrop] (Airdrop: undefined, Scam: undefined, Score: undefined)
// Analyzing: EigenLayer Makes A Big Splash With EIGEN Token Launch And Major Airdrop Plan, Get The Full Scoop! (Score: 32)...
// Gemini API Error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.
// Filtered: EigenLayer Makes A Big Splash With EIGEN Token Launch And Major Airdrop Plan, Get The Full Scoop! (Airdrop: undefined, Scam: undefined, Score: undefined)
// Analyzing: Wormhole $617M Airdrop Ignites Valuation Surge To $3B, But W Price Stumbles 23% (Score: 36)...
// Gemini API Error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.
// Filtered: Wormhole $617M Airdrop Ignites Valuation Surge To $3B, But W Price Stumbles 23% (Airdrop: undefined, Scam: undefined, Score: undefined)
// Analyzing: Ether.fi $210M Airdrop Sparks Market Turbulence, ETHFI Value Drops By 35% (Score: 34)...
// Gemini API Error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.
// Filtered: Ether.fi $210M Airdrop Sparks Market Turbulence, ETHFI Value Drops By 35% (Airdrop: undefined, Scam: undefined, Score: undefined)
// Analyzing: Celestia Network: How To Stake TIA And Position For 5-Figure Airdrops (Score: 42)...
// Gemini API Error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.
// Filtered: Celestia Network: How To Stake TIA And Position For 5-Figure Airdrops (Airdrop: undefined, Scam: undefined, Score: undefined)
// Analyzing: 2023’s Crypto Bounty: These Top 13 Airdrops Distributed Over $4 Billion (Score: 32)...
// Gemini API Error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.
// Filtered: 2023’s Crypto Bounty: These Top 13 Airdrops Distributed Over $4 Billion (Airdrop: undefined, Scam: undefined, Score: undefined)
// Analyzing: LayerZero Crosses This Significant Milestone, But Is An Airdrop Coming? (Score: 36)...
// Gemini API Error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.
// Filtered: LayerZero Crosses This Significant Milestone, But Is An Airdrop Coming? (Airdrop: undefined, Scam: undefined, Score: undefined)
// --- Scraper Service Finished ---
// Job finished successfully.
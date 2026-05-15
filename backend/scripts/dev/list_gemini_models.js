require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in your .env file.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
console.log('--- genAI object ---');
console.log(genAI);
console.log('--- genAI prototype ---');
console.log(Object.getPrototypeOf(genAI));

async function listModels() {
  try {
    const { models } = await genAI.listModels();
    console.log('Available Gemini Models:');
    for (const model of models) {
      console.log(`- ${model.name}`);
    }
  } catch (error) {
    console.error('Error listing models:', error.message || error);
    console.error('Please ensure your GEMINI_API_KEY is correct and has access to the Gemini API.');
  }
}

listModels();

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModels() {
  const modelsToTest = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-pro'
  ];

  for (const modelName of modelsToTest) {
    console.log(`Testing model: ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say hello world in JSON. {"msg": "hello world"}', { responseMimeType: "application/json" });
      const response = await result.response;
      console.log(`✅ Success with ${modelName}:`, response.text().trim());
    } catch (error) {
      if (error.status === 429) {
        console.log(`❌ Rate Limit (429) for ${modelName}`);
      } else if (error.status === 404) {
        console.log(`❌ Not Found (404) for ${modelName}`);
      } else {
        console.log(`❌ Error for ${modelName}:`, error.message);
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

testModels();
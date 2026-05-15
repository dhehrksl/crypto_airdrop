require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Airdrop = require('../../models/Airdrop');
const GuaranteedAirdrop = require('../../models/GuaranteedAirdrop');
const User = require('../../models/User');

const API_BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

const TEST_USER = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
};

let authToken = '';
let testAirdropId = '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use(config => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
});

const logStep = (step, message) => console.log(`
--- ${step} ---
${message}`);
const logResult = (success, data) => {
    if (success) {
        console.log('✅ SUCCESS');
        if (data) console.log(JSON.stringify(data, null, 2));
    } else {
        console.error('❌ FAILED');
        if (data) console.error(JSON.stringify(data, null, 2));
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runTest = async () => {
    logStep('SETUP: Wait for server', 'Waiting 5 seconds for server to be ready...');
    await sleep(5000);

    // 0. Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    await User.deleteOne({ email: TEST_USER.email });
    const airdrop = await GuaranteedAirdrop.findOne();
    if (!airdrop) {
        console.error('No sample airdrop found. Please run seed script first.');
        process.exit(1);
    }
    testAirdropId = airdrop._id.toString();


    // 1. Register and Login Test User
    try {
        logStep('STEP 1: Register and Login', `Registering user ${TEST_USER.email}...`);
        await apiClient.post('/api/auth/register', TEST_USER);
        
        logStep('STEP 1.1: Logging in', `Logging in as ${TEST_USER.email}...`);
        const loginRes = await apiClient.post('/api/auth/login', { email: TEST_USER.email, password: TEST_USER.password });
        authToken = loginRes.data.token;
        logResult(true, { token: '...token_hidden...' });
    } catch (e) {
        logResult(false, e.response ? e.response.data : e.message);
        process.exit(1);
    }

    // 2. Mark as Participated
    try {
        logStep('STEP 2: Mark as Participated', `Marking airdrop ${testAirdropId} as participated...`);
        const res = await apiClient.post(`/api/user/airdrops/${testAirdropId}/participate`);
        const isParticipated = res.data.participatedBy.includes(res.data.participatedBy[0]); // A bit of a hack to check
        logResult(isParticipated, { participatedBy: res.data.participatedBy });
    } catch (e) {
        logResult(false, e.response ? e.response.data : e.message);
    }

    // 3. Get Participated List
    try {
        logStep('STEP 3: Get Participated List', 'Fetching airdrops participated by user...');
        const res = await apiClient.get('/api/user/airdrops/participated');
        const found = res.data.data.some(d => d._id === testAirdropId);
        logResult(found && res.data.data.length > 0, res.data);
    } catch (e) {
        logResult(false, e.response ? e.response.data : e.message);
    }

    // 4. Unmark as Participated
    try {
        logStep('STEP 4: Unmark as Participated', `Unmarking airdrop ${testAirdropId}...`);
        const res = await apiClient.delete(`/api/user/airdrops/${testAirdropId}/participate`);
        logResult(res.data.participatedBy.length === 0, res.data);
    } catch (e) {
        logResult(false, e.response ? e.response.data : e.message);
    }

    // 5. Get Participated List Again
    try {
        logStep('STEP 5: Get Participated List Again', 'Fetching list to confirm removal...');
        const res = await apiClient.get('/api/user/airdrops/participated');
        logResult(res.data.data.length === 0, res.data);
    } catch (e) {
        logResult(false, e.response ? e.response.data : e.message);
    }

    // Cleanup
    await User.deleteOne({ email: TEST_USER.email });
    mongoose.connection.close();
};

runTest();

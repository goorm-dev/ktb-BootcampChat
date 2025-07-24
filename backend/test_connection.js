// Test database and service connections
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnections() {
    console.log('Testing connections...');
    
    try {
        // Test MongoDB connection
        console.log('1. Testing MongoDB connection...');
        console.log('MongoDB URI:', process.env.MONGO_URI || 'mongodb://localhost:27017/bootcampchat');
        
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bootcampchat');
        console.log('✅ MongoDB connected successfully');
        
        // Test OpenAI API key
        console.log('2. Testing OpenAI API key...');
        console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Set ✅' : 'Not Set ❌');
        
        // Test a simple MongoDB query
        console.log('3. Testing MongoDB query...');
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections found:', collections.map(c => c.name));
        
        // Close connection
        await mongoose.connection.close();
        console.log('✅ All tests completed');
        
    } catch (error) {
        console.error('❌ Connection test failed:', error);
    }
}

testConnections();

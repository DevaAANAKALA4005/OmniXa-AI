const mongoose = require('mongoose');
const dns = require('dns');

// Set DNS to Google's public DNS servers
dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = 'mongodb+srv://sairam44sairam_db_user:698069@omnixaai.yl7sgnb.mongodb.net/omnixaai?retryWrites=true&w=majority&appName=OmniXaAI';

console.log('Testing with Google DNS...');
mongoose.connect(uri)
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

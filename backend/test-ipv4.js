const mongoose = require('mongoose');

const uri = 'mongodb+srv://sairam44sairam_db_user:698069@omnixaai.yl7sgnb.mongodb.net/omnixaai?retryWrites=true&w=majority&appName=OmniXaAI';

console.log('Testing with family: 4...');
mongoose.connect(uri, { family: 4 })
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

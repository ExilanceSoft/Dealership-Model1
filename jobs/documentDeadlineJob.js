// jobs/documentDeadlineJob.js
const documentDeadlineController = require('../controllers/documentDeadlineController');
const cron = require('node-cron');

// Run every hour to check for overdue documents
cron.schedule('0 * * * *', async () => {
  console.log('Running document deadline check...');
  try {
    const result = await documentDeadlineController.checkDocumentDeadlines();
    console.log(`Document deadline check completed. Processed ${result.processed} bookings.`);
  } catch (error) {
    console.error('Error in document deadline job:', error);
  }
});

module.exports = cron;
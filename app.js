const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/db');
const { setupSwagger, getLocalIp } = require('./config/swagger');

// Error handlers at the beginning
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const ipRoutes = require('./routes/ipWhitelistRoutes');
const auditLog = require('./routes/auditLogRoutes');
const brokerRoutes = require('./routes/brokerRoutes');
const rtoRoutes = require('./routes/rtoRoutes');
const branchRoutes = require('./routes/branchRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
// const modelRoutes = require('./routes/vehicleModelRoutes');
const colorRoutes = require('./routes/vehicleColorRoutes');
const inwardRoutes = require('./routes/vehicleInwardRoutes');
const modelRoutes = require('./routes/modelRoutes');
const headerRoutes = require('./routes/headerRoutes');
const attachmentRoutes = require('./routes/attachmentRoutes');
const csvRoutes = require('./routes/csvRoutes');
const customerRoutes = require('./routes/customerRoutes');
const financeDocumentRoutes = require('./routes/financeDocumentRoutes');
const offerRoutes = require('./routes/offerRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const termsConditionRoutes = require('./routes/termsConditionRoutes')



// Initialize express app
const app = express();

// Apply middleware
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:"],
      connectSrc: ["'self'", "https:", "http:"] 
    }
  },
  crossOriginEmbedderPolicy: false
}));


// Logger for development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Configure Swagger
setupSwagger(app);

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/ip-whitelist', ipRoutes);
app.use('/api/v1/audit-logs', auditLog);
app.use('/api/v1/brokers', brokerRoutes);
app.use('/api/v1/rtos', rtoRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/models', modelRoutes);
app.use('/api/v1/colors', colorRoutes);
app.use('/api/v1/inward', inwardRoutes);
app.use('/api/v1/headers',headerRoutes);
app.use('/api/v1/attachments',attachmentRoutes);
app.use('/api/v1/csv',csvRoutes);
app.use('/api/v1/customers',customerRoutes);
app.use('/api/v1/finance-documents',financeDocumentRoutes);
app.use('/api/v1/offers',offerRoutes);
app.use('/api/v1/quotations',quotationRoutes);
app.use('/api/v1/terms-conditions',termsConditionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Server Error' 
  });
});

// Start server
const PORT = process.env.PORT || 5002;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}/api-docs`);
  if (process.env.NODE_ENV === 'development') {
    const localIp = getLocalIp();
    console.log(`Network: http://${localIp}:${PORT}/api-docs`);
  }
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});



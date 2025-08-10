// // Import required modules
// const express = require('express');
// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const morgan = require('morgan');
// const helmet = require('helmet');
// const cors = require('cors');
// const connectDB = require('./config/db');
// const { setupSwagger, getLocalIp } = require('./config/swagger');
// const path = require('path');
// const { runDocumentCheck } = require('./jobs/documentDeadlineJob');
// const fs = require('fs'); // Add this line


// // Uncaught exception handler
// process.on('uncaughtException', (err) => {
//   console.error('Uncaught Exception:', err);
//   process.exit(1);
// });

// // Load environment variables from .env file
// dotenv.config();

// // Validate required environment variables
// const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
// for (const envVar of requiredEnvVars) {
//   if (!process.env[envVar]) {
//     console.error(`Missing required environment variable: ${envVar}`);
//     process.exit(1);
//   }
// }

// // Connect to MongoDB
// connectDB().catch(err => {
//   console.error('Failed to connect to MongoDB:', err);
//   process.exit(1);
// });

// // Run initial document check on startup
// runDocumentCheck().catch(err => {
//   console.error('Initial document check failed:', err);
// });

// // Import all route files
// const authRoutes = require('./routes/authRoutes');
// const userRoutes = require('./routes/userRoutes');
// const roleRoutes = require('./routes/roleRoutes');
// const ipRoutes = require('./routes/ipWhitelistRoutes');
// const auditLog = require('./routes/auditLogRoutes');
// const brokerRoutes = require('./routes/brokerRoutes');
// const rtoRoutes = require('./routes/rtoRoutes');
// const branchRoutes = require('./routes/branchRoutes');
// const employeeRoutes = require('./routes/employeeRoutes');
// const colorRoutes = require('./routes/colorRoutes');
// const vehicleInwardRoutes = require('./routes/vehicleInwardRoutes');
// const modelRoutes = require('./routes/modelRoutes');
// const headerRoutes = require('./routes/headerRoutes');
// const attachmentRoutes = require('./routes/attachmentRoutes');
// const csvRoutes = require('./routes/csvRoutes');
// const customerRoutes = require('./routes/customerRoutes');
// const financeDocumentRoutes = require('./routes/financeDocumentRoutes');
// const offerRoutes = require('./routes/offerRoutes');
// const quotationRoutes = require('./routes/quotationRoutes');
// const termsConditionRoutes = require('./routes/termsConditionRoutes');
// const permissionRoutes = require('./routes/permissionRoutes');
// const insuranceProviderRoutes = require('./routes/insuranceProviderRoutes');
// const financerRoutes = require('./routes/financerRoutes');
// const accessoryRoutes = require('./routes/accessoryRoutes');
// const bookingRoutes = require('./routes/bookingRoutes');
// const kycRoutes = require('./routes/kycRoutes')
// const FinanceLetterRoutes = require('./routes/financeLetterRoutes');
// const AccessoryCategoryRoutes = require('./routes/accessoryCategoryRoutes');
// const stockTransferRoutes = require('./routes/stockTransferRoutes');
// const bankRoutes = require('./routes/bankRoutes');
// const ledgerRoutes = require('./routes/ledgerRoutes');
// const cashLocationRoutes = require('./routes/cashLocationRoutes');
// const insuranceRoutes = require('./routes/insuranceRoutes');
// const declarationsRoutes = require('./routes/declarationRoutes');
// const expenseAccountsRoutes = require('./routes/expenseAccountRoutes');
// const rtoProcessRoutes = require('./routes/rtoProcessRoutes');
// const cashVoucherRoutes = require("./routes/cashVouchersRoutes");
// const contraVoucherRoutes = require('./routes/contraVoucherRoutes');
// const insuranceReciptRoutes = require('./routes/insuranceReciptRoutes');
// const newInsuranceRoutes = require('./routes/newInsuranceRoutes');
// const app = express();
// app.use('/api/v1/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/api/v1/images', express.static(path.join(__dirname, 'public', 'images')));
// app.use('/api/v1',express.static(path.join(__dirname, 'templates')));
// app.use('/api/v1/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
// // Middleware to parse JSON bodies
// app.use(express.json());
// // Add this test route before your other routes
// app.get('/test-logo', (req, res) => {
//   const logoPath = path.join(__dirname, 'public/images/logo.png');
//   if (fs.existsSync(logoPath)) {
//     res.send(`Logo exists at: ${logoPath}`);
//   } else {
//     res.status(404).send('Logo not found at: ' + logoPath);
//   }
// });
// // Configure CORS
// app.use(cors({
//   origin: [
//     'http://localhost:5002',
//     `http://${getLocalIp()}:5002`,
//     'http://localhost:3000',
//     'http://localhost:3000/tvs',
//     'http://127.0.0.1:5500',
//     'https://exilance.com/tvs',
//     'https://exilance.com'
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//   exposedHeaders: ['Authorization']
// }));

// // Security middleware with Swagger UI compatibility
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
//       styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
//       imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
//       fontSrc: ["'self'", "https:", "http:", "data:"],
//       connectSrc: ["'self'", "https:", "http:", "ws:"],
//       frameSrc: ["'self'", "https:"]
//     }
//   },
//   crossOriginEmbedderPolicy: false,
//   crossOriginOpenerPolicy: false,
//   crossOriginResourcePolicy: { policy: "cross-origin" }
// }));

// // HTTP request logging in development
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

// // Setup Swagger documentation
// setupSwagger(app);

// // Mount all API routes with /api/v1 prefix
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/users', userRoutes);
// app.use('/api/v1/roles', roleRoutes);
// app.use('/api/v1/ip-whitelist', ipRoutes);
// app.use('/api/v1/audit-logs', auditLog);
// app.use('/api/v1/brokers', brokerRoutes);
// app.use('/api/v1/rtos', rtoRoutes);
// app.use('/api/v1/branches', branchRoutes);
// app.use('/api/v1/employees', employeeRoutes);
// app.use('/api/v1/models', modelRoutes);
// app.use('/api/v1/colors', colorRoutes);
// app.use('/api/v1/vehicles', vehicleInwardRoutes);
// app.use('/api/v1/headers', headerRoutes);
// app.use('/api/v1/attachments', attachmentRoutes);
// app.use('/api/v1/csv', csvRoutes);
// app.use('/api/v1/customers', customerRoutes);
// app.use('/api/v1/finance-documents', financeDocumentRoutes);
// app.use('/api/v1/offers', offerRoutes);
// app.use('/api/v1/quotations', quotationRoutes);
// app.use('/api/v1/terms-conditions', termsConditionRoutes);
// app.use('/api/v1/permissions', permissionRoutes);
// app.use('/api/v1/insurance-providers', insuranceProviderRoutes);
// app.use('/api/v1/financers', financerRoutes);
// app.use('/api/v1/accessories', accessoryRoutes);
// app.use('/api/v1/bookings', bookingRoutes);
// app.use('/api/v1/kyc',kycRoutes);
// app.use('/api/v1/finance-letters',FinanceLetterRoutes);
// app.use('/api/v1/accessory-categories',AccessoryCategoryRoutes);
// app.use('/api/v1/transfers',stockTransferRoutes);
// app.use('/api/v1/banks',bankRoutes);
// app.use('/api/v1/ledger', ledgerRoutes);
// app.use('/api/v1/cash-locations',cashLocationRoutes);
// app.use('/api/v1/insurance',insuranceRoutes);
// app.use('/api/v1/declarations',declarationsRoutes);
// app.use('/api/v1/expense-accounts',expenseAccountsRoutes);
// app.use('/api/v1/rtoProcess',rtoProcessRoutes)
// app.use("/api/v1/cash-vouchers", cashVoucherRoutes);
// app.use('/api/v1/contra-vouchers', contraVoucherRoutes);
// app.use('/api/v1/insurance-recipt', insuranceReciptRoutes);
// app.use('/api/v1/new-insurance',newInsuranceRoutes);

// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.status(200).json({ 
//     status: 'ok',
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime()
//   });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error('Error:', err.stack);
//   res.status(500).json({ 
//     success: false, 
//     message: 'Server Error',
//     error: process.env.NODE_ENV === 'development' ? err.message : undefined
//   });
// });

// // Start the server
// const PORT = process.env.PORT || 5002;
// const server = app.listen(PORT, '0.0.0.0', () => {
//   const localIp = getLocalIp();
//   console.log(`Server running on port ${PORT}`);
//   console.log(`Local access: http://localhost:${PORT}/api-docs`);
//   console.log(`Network access: http://${localIp}:${PORT}/api-docs`);
//   console.log(`Health check: http://localhost:${PORT}/health`);
// });

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (err) => {
//   console.error('Unhandled Rejection:', err);
//   server.close(() => process.exit(1));
// });

// // Graceful shutdown handler
// process.on('SIGTERM', () => {
//   console.log('SIGTERM received. Shutting down gracefully...');
//   server.close(() => {
//     console.log('Server closed');
//     process.exit(0);
//   });
// });

// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/db');
const { setupSwagger, getLocalIp } = require('./config/swagger');
const path = require('path');
const { runDocumentCheck } = require('./jobs/documentDeadlineJob');
const fs = require('fs');

//  NEW: auto-seed permission catalog so the Roles Permission Matrix always has data
const { ensureCatalog } = require('./services/permissionBootstrap');

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Load environment variables from .env file
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();

/* -----------------------------
   Static asset mounts
------------------------------ */
app.use('/api/v1/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/v1/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/api/v1', express.static(path.join(__dirname, 'templates')));
// If you need both places, keep both mounts; order matters (first wins if file exists there)
app.use('/api/v1/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

/* -----------------------------
   Core middlewares
------------------------------ */
// Parse JSON bodies
app.use(express.json());

// Simple test route to verify logo path exists
app.get('/test-logo', (req, res) => {
  const logoPath = path.join(__dirname, 'public/images/logo.png');
  if (fs.existsSync(logoPath)) {
    res.send(`Logo exists at: ${logoPath}`);
  } else {
    res.status(404).send('Logo not found at: ' + logoPath);
  }
});

// Configure CORS
app.use(cors({
  origin: [
    'http://localhost:5002',
    `http://${getLocalIp()}:5002`,
    'http://localhost:3000',
    'http://localhost:3000/tvs',
    'http://127.0.0.1:5500',
    'https://exilance.com/tvs',
    'https://exilance.com',
    'https://dealership.gandhitvs.in'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization']
}));

// Security middleware with Swagger UI compatibility
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
      fontSrc: ["'self'", "https:", "http:", "data:"],
      connectSrc: ["'self'", "https:", "http:", "ws:"],
      frameSrc: ["'self'", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// HTTP request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Setup Swagger documentation
setupSwagger(app);

/* -----------------------------
   Routes (imports)
------------------------------ */
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const ipRoutes = require('./routes/ipWhitelistRoutes');
const auditLog = require('./routes/auditLogRoutes');
const brokerRoutes = require('./routes/brokerRoutes');
const rtoRoutes = require('./routes/rtoRoutes');
const branchRoutes = require('./routes/branchRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const colorRoutes = require('./routes/colorRoutes');
const vehicleInwardRoutes = require('./routes/vehicleInwardRoutes');
const modelRoutes = require('./routes/modelRoutes');
const headerRoutes = require('./routes/headerRoutes');
const attachmentRoutes = require('./routes/attachmentRoutes');
const csvRoutes = require('./routes/csvRoutes');
const customerRoutes = require('./routes/customerRoutes');
const financeDocumentRoutes = require('./routes/financeDocumentRoutes');
const offerRoutes = require('./routes/offerRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const termsConditionRoutes = require('./routes/termsConditionRoutes');
const permissionRoutes = require('./routes/permissionRoutes'); 
const insuranceProviderRoutes = require('./routes/insuranceProviderRoutes');
const financerRoutes = require('./routes/financerRoutes');
const accessoryRoutes = require('./routes/accessoryRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const kycRoutes = require('./routes/kycRoutes');
const FinanceLetterRoutes = require('./routes/financeLetterRoutes');
const AccessoryCategoryRoutes = require('./routes/accessoryCategoryRoutes');
const stockTransferRoutes = require('./routes/stockTransferRoutes');
const bankRoutes = require('./routes/bankRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const cashLocationRoutes = require('./routes/cashLocationRoutes');
const insuranceRoutes = require('./routes/insuranceRoutes');
const declarationsRoutes = require('./routes/declarationRoutes');
const expenseAccountsRoutes = require('./routes/expenseAccountRoutes');
const rtoProcessRoutes = require('./routes/rtoProcessRoutes');
const cashVoucherRoutes = require("./routes/cashVouchersRoutes");
const contraVoucherRoutes = require('./routes/contraVoucherRoutes');
const insuranceReciptRoutes = require('./routes/insuranceReciptRoutes');
const newInsuranceRoutes = require('./routes/newInsuranceRoutes');

/* -----------------------------
   API mount points
------------------------------ */
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);

// IMPORTANT: keep /permissions here so the frontend matrix can load without admin token
app.use('/api/v1/permissions', permissionRoutes);

app.use('/api/v1/ip-whitelist', ipRoutes);
app.use('/api/v1/audit-logs', auditLog);
app.use('/api/v1/brokers', brokerRoutes);
app.use('/api/v1/rtos', rtoRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/models', modelRoutes);
app.use('/api/v1/colors', colorRoutes);
app.use('/api/v1/vehicles', vehicleInwardRoutes);
app.use('/api/v1/headers', headerRoutes);
app.use('/api/v1/attachments', attachmentRoutes);
app.use('/api/v1/csv', csvRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/finance-documents', financeDocumentRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/quotations', quotationRoutes);
app.use('/api/v1/terms-conditions', termsConditionRoutes);
app.use('/api/v1/insurance-providers', insuranceProviderRoutes);
app.use('/api/v1/financers', financerRoutes);
app.use('/api/v1/accessories', accessoryRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/finance-letters', FinanceLetterRoutes);
app.use('/api/v1/accessory-categories', AccessoryCategoryRoutes);
app.use('/api/v1/transfers', stockTransferRoutes);
app.use('/api/v1/banks', bankRoutes);
app.use('/api/v1/ledger', ledgerRoutes);
app.use('/api/v1/cash-locations', cashLocationRoutes);
app.use('/api/v1/insurance', insuranceRoutes);
app.use('/api/v1/declarations', declarationsRoutes);
app.use('/api/v1/expense-accounts', expenseAccountsRoutes);
app.use('/api/v1/rtoProcess', rtoProcessRoutes);
app.use('/api/v1/cash-vouchers', cashVoucherRoutes);
app.use('/api/v1/contra-vouchers', contraVoucherRoutes);
app.use('/api/v1/insurance-recipt', insuranceReciptRoutes);
app.use('/api/v1/new-insurance', newInsuranceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

/* -----------------------------
   DB connect + bootstrap jobs
------------------------------ */
// Connect to MongoDB, then seed permissions and run jobs that need DB
connectDB()
  .then(async () => {
    try {
      await ensureCatalog(); // ✅ make sure Permission docs exist for all MODULE.ACTION in catalog
      console.log('[Permissions] Catalog ensured');

      // Run initial document check on startup (after DB is up)
      await runDocumentCheck();
      console.log('[Jobs] Initial document deadline check completed');
    } catch (e) {
      console.error('Post-connect bootstrap failed:', e);
    }
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

/* -----------------------------
   Start the server
------------------------------ */
const PORT = process.env.PORT || 5002;
const server = app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access:  http://localhost:${PORT}/api-docs`);
  console.log(`Network access: http://${localIp}:${PORT}/api-docs`);
  console.log(`Health check:  http://localhost:${PORT}/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

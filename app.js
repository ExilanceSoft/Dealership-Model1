// app.js
// Complete, corrected server entry with safe RBAC bootstrap (no conflicting update ops).

// -------------------------------
// Imports
// -------------------------------
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const { setupSwagger, getLocalIp } = require('./config/swagger');
const { runDocumentCheck } = require('./jobs/documentDeadlineJob');

// RBAC bootstrap helpers
const { ensureCatalog } = require('./services/permissionBootstrap');
const { initializeRoles } = require('./utils/initializeRoles');

// -------------------------------
// Process guards
// -------------------------------
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// -------------------------------
// Env
// -------------------------------
dotenv.config();

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// -------------------------------
// App init
// -------------------------------
const app = express();


// -------------------------------
// Static assets
// -------------------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/v1/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/v1/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/api/v1', express.static(path.join(__dirname, 'templates')));
// If you store some files under public/uploads as well, keep this additional mount:
app.use('/api/v1/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
// app.use('/api/v1/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------------------
// Core middlewares
// -------------------------------
app.use(express.json());

app.get('/test-logo', (req, res) => {
  const logoPath = path.join(__dirname, 'public/images/logo.png');
  if (fs.existsSync(logoPath)) {
    res.send(`Logo exists at: ${logoPath}`);
  } else {
    res.status(404).send('Logo not found at: ' + logoPath);
  }
});

app.use(cors({
  origin: [
    'http://localhost:5002',
    `http://${getLocalIp()}:5002`,
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:3000/tvs',
    'http://localhost:3001/tvs',
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

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// -------------------------------
// Swagger
// -------------------------------
setupSwagger(app);

// -------------------------------
// Routes (imports)
// -------------------------------
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionRoutes = require('./routes/permissionRoutes');

const ipRoutes = require('./routes/ipWhitelistRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
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
const insuranceProviderRoutes = require('./routes/insuranceProviderRoutes');
const financerRoutes = require('./routes/financerRoutes');
const accessoryRoutes = require('./routes/accessoryRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const kycRoutes = require('./routes/kycRoutes');
const financeLetterRoutes = require('./routes/financeLetterRoutes');
const accessoryCategoryRoutes = require('./routes/accessoryCategoryRoutes');
const stockTransferRoutes = require('./routes/stockTransferRoutes');
const bankRoutes = require('./routes/bankRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const cashLocationRoutes = require('./routes/cashLocationRoutes');
const insuranceRoutes = require('./routes/insuranceRoutes');
const declarationsRoutes = require('./routes/declarationRoutes');
const expenseAccountsRoutes = require('./routes/expenseAccountRoutes');
const rtoProcessRoutes = require('./routes/rtoProcessRoutes');
const cashVoucherRoutes = require('./routes/cashVouchersRoutes');
const contraVoucherRoutes = require('./routes/contraVoucherRoutes');
const insuranceReciptRoutes = require('./routes/insuranceReciptRoutes');
const newInsuranceRoutes = require('./routes/newInsuranceRoutes');
const brokerLedgerRoutes = require('./routes/brokerLedgerRoutes');
const allCashReciptRoutes = require('./routes/allCashReciptRoutes');
const workshopReciptRoutes = require('./routes/workshopReciptRoutes');
const subdealerRoutes = require('./routes/subdealerRoutes');
const subDealerModelsRoutes = require('./routes/SubDealerModelsRoutes');
const subDealerOnAccountRoutes = require('./routes/subdealerOnAccountRoutes')
const financeDisbursementRoutes = require('./routes/financeDisbursementRoutes');
const commissionMasterRoutes = require('./routes/commissionMasterRoutes');
const commissionPaymentRoutes = require('./routes/commissionPaymentRoutes');
const bankSubPaymentModeRoutes = require('./routes/bankSubPaymentRoutes');
const commissionRangeRoutes = require('./routes/commissionRangeRoutes');
const disbursementRoutes = require('./routes/disbursementRoutes');
// const financeDisbursementRoutes1 = require('./routes/financeDisbursementRoutes1')
// -------------------------------
// Route mounts
// -------------------------------
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);

// Keep /permissions available so UI can fetch catalog
app.use('/api/v1/permissions', permissionRoutes);

app.use('/api/v1/ip-whitelist', ipRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
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
app.use('/api/v1/finance-letters', financeLetterRoutes);
app.use('/api/v1/accessory-categories', accessoryCategoryRoutes);
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
app.use('/api/v1/broker-ledger', brokerLedgerRoutes);
app.use('/api/v1/vouchers', allCashReciptRoutes);
app.use('/api/v1/workshop-receipts', workshopReciptRoutes);
app.use('/api/v1/subdealers', subdealerRoutes);
app.use('/api/v1/subdealer/models', subDealerModelsRoutes);
app.use('/api/v1/subdealersonaccount', subDealerOnAccountRoutes);
app.use('/api/v1/finance-disbursements', financeDisbursementRoutes);
app.use('/api/v1/commission-master', commissionMasterRoutes);
app.use('/api/v1/commission-payments', commissionPaymentRoutes);
app.use('/api/v1/banksubpaymentmodes', bankSubPaymentModeRoutes);
app.use('/api/v1/commission-ranges', commissionRangeRoutes);
// app.use('/api/v1/down-payments', downPaymentRoutes);
app.use('/api/v1/disbursements', disbursementRoutes);
require('./bootstrap/subdealerLedgerBootstrap');


// -------------------------------
// Health
// -------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// -------------------------------
// Error handler
// -------------------------------
app.use((err, req, res, next) => {
  console.error('Error:', err.stack || err);
  res.status(500).json({
    success: false,
    message: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// -------------------------------
// DB connect + bootstrap
// -------------------------------
connectDB()
  .then(async () => {
    try {
      // Seed/activate permissions from catalog (safe, idempotent)
      await ensureCatalog();
      console.log('[RBAC] Permission catalog ensured');

      // Ensure SUPERADMIN has all permissions (idempotent)
      await initializeRoles();
      console.log('[RBAC] SUPERADMIN ensured');

      // Run initial jobs that require DB
      await runDocumentCheck();
      console.log('[Jobs] Initial document deadline check completed');
    } catch (e) {
      console.error('Post-connect bootstrap failed:', e);
    }
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// -------------------------------
// Server
// -------------------------------
const PORT = process.env.PORT || 5002;
const server = app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access:  http://localhost:${PORT}/api-docs`);
  console.log(`Network access: http://${localIp}:${PORT}/api-docs`);
  console.log(`Health check:  http://localhost:${PORT}/health`);
});

// -------------------------------
// Process guards (async)
// -------------------------------
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

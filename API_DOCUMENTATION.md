# Vehicle Dealership Management System API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Authentication & Authorization](#authentication--authorization)
5. [API Endpoints](#api-endpoints)
6. [Error Handling](#error-handling)
7. [File Upload](#file-upload)
8. [Security Features](#security-features)
9. [Development Setup](#development-setup)
10. [Deployment](#deployment)

## Overview

The Vehicle Dealership Management System is a comprehensive REST API built with Node.js, Express, and MongoDB. It provides complete management capabilities for vehicle dealership operations including:

- User management and role-based access control
- Vehicle inventory and inward management
- Customer relationship management
- Booking and quotation management
- Financial operations (ledger, banking, insurance)
- Document management and file uploads
- Audit logging and compliance
- Reporting and analytics

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5.1.0
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Documentation**: Swagger/OpenAPI 3.0
- **Logging**: Winston with daily rotation
- **Security**: Helmet, CORS, Rate limiting
- **PDF Generation**: PDFKit
- **QR Code**: qrcode
- **Web Scraping**: Puppeteer

### Key Dependencies
```json
{
  "express": "^5.1.0",
  "mongoose": "^8.16.0",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^3.0.2",
  "multer": "^2.0.1",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1",
  "winston": "^3.17.0",
  "helmet": "^8.1.0",
  "cors": "^2.8.5"
}
```

## Database Schema

### Core Models

#### 1. User Model (`models/User.js`)
```javascript
{
  name: String (required),
  email: String (required, unique, validated),
  mobile: String (required, unique, validated),
  otp: String,
  otpExpires: Date,
  roles: [ObjectId] (ref: Role),
  permissions: [{
    permission: ObjectId (ref: Permission),
    grantedBy: ObjectId (ref: User),
    expiresAt: Date
  }],
  branch: ObjectId (ref: Branch),
  discount: Number,
  is_active: Boolean,
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User)
}
```

#### 2. Role Model (`models/Role.js`)
```javascript
{
  name: String (required, unique),
  description: String,
  permissions: [ObjectId] (ref: Permission),
  is_active: Boolean,
  isSuperAdmin: Boolean,
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User)
}
```

#### 3. Branch Model (`models/Branch.js`)
```javascript
{
  name: String (required),
  address: String,
  contact: String,
  email: String,
  logo1: String,
  logo2: String,
  is_active: Boolean,
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User)
}
```

#### 4. Vehicle Inward Model (`models/vehicleInwardModel.js`)
```javascript
{
  vehicleNumber: String (required),
  model: ObjectId (ref: VehicleModel),
  color: ObjectId (ref: Color),
  engineNumber: String,
  chassisNumber: String,
  keyNumber: String,
  rto: ObjectId (ref: Rto),
  branch: ObjectId (ref: Branch),
  status: String,
  inwardDate: Date,
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User)
}
```

#### 5. Booking Model (`models/Booking.js`)
```javascript
{
  bookingNumber: String (required, unique),
  customer: ObjectId (ref: Customer),
  vehicle: ObjectId (ref: vehicleInwardModel),
  bookingAmount: Number,
  bookingDate: Date,
  status: String,
  accessories: [ObjectId] (ref: Accessory),
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User)
}
```

#### 6. Customer Model (`models/CustomerModel.js`)
```javascript
{
  name: String (required),
  mobile: String (required),
  email: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User)
}
```

#### 7. Quotation Model (`models/QuotationModel.js`)
```javascript
{
  quotationNumber: String (required, unique),
  customer: ObjectId (ref: Customer),
  vehicle: ObjectId (ref: vehicleInwardModel),
  basePrice: Number,
  accessories: [{
    accessory: ObjectId (ref: Accessory),
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  status: String,
  validTill: Date,
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User)
}
```

#### 8. Ledger Model (`models/Ledger.js`)
```javascript
{
  date: Date (required),
  description: String (required),
  debit: Number,
  credit: Number,
  balance: Number,
  type: String,
  reference: String,
  branch: ObjectId (ref: Branch),
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User)
}
```

### Additional Models
- **Accessory**: Vehicle accessories and parts
- **AccessoryCategory**: Categories for accessories
- **Bank**: Banking information
- **Broker**: Broker management
- **Color**: Vehicle colors
- **Employee**: Employee management
- **FinanceDocument**: Financial documents
- **FinanceLetter**: Finance letters
- **Insurance**: Insurance policies
- **InsuranceProvider**: Insurance providers
- **KYC**: Know Your Customer documents
- **Model**: Vehicle models
- **Offer**: Special offers and promotions
- **Permission**: System permissions
- **Receipt**: Payment receipts
- **Rto**: RTO information
- **RtoProcess**: RTO processing
- **StockTransfer**: Stock transfer between branches
- **TermsCondition**: Terms and conditions

## Authentication & Authorization

### JWT Token Structure
```javascript
{
  id: User._id,
  email: User.email,
  roles: User.roles,
  permissions: User.permissions,
  branch: User.branch
}
```

### Permission System
- **Role-based**: Users inherit permissions from their roles
- **Direct permissions**: Users can have additional permissions granted directly
- **Temporary permissions**: Permissions can have expiration dates
- **SuperAdmin**: Special role with all permissions

### Middleware
- `protect`: Verifies JWT token and attaches user to request
- `hasPermission`: Checks if user has specific permission
- `audit`: Logs all actions for audit trail

## API Endpoints

### Base URL
```
http://localhost:5002/api/v1
```

### Authentication Endpoints

#### POST `/auth/register`
Register a new user
- **Open endpoint** for first user (creates SuperAdmin)
- **Authenticated** for subsequent registrations
- **Permissions**: CAN_REGISTER_USERS

#### POST `/auth/login`
User login
- Returns JWT token
- Validates OTP if required

#### POST `/auth/verify-otp`
Verify OTP for registration/login

#### POST `/auth/forgot-password`
Send password reset OTP

#### POST `/auth/reset-password`
Reset password with OTP

#### POST `/auth/logout`
User logout (blacklist token)

### User Management

#### GET `/users`
Get all users (paginated)
- **Permissions**: CAN_VIEW_USERS

#### POST `/users`
Create new user
- **Permissions**: CAN_CREATE_USERS

#### GET `/users/:id`
Get user by ID
- **Permissions**: CAN_VIEW_USERS

#### PUT `/users/:id`
Update user
- **Permissions**: CAN_UPDATE_USERS

#### DELETE `/users/:id`
Delete user
- **Permissions**: CAN_DELETE_USERS

### Role Management

#### GET `/roles`
Get all roles
- **Permissions**: CAN_VIEW_ROLES

#### POST `/roles`
Create new role
- **Permissions**: CAN_CREATE_ROLES

#### PUT `/roles/:id`
Update role
- **Permissions**: CAN_UPDATE_ROLES

#### DELETE `/roles/:id`
Delete role
- **Permissions**: CAN_DELETE_ROLES

### Branch Management

#### GET `/branches`
Get all branches
- **Permissions**: CAN_VIEW_BRANCHES

#### POST `/branches`
Create new branch
- **Permissions**: CAN_CREATE_BRANCHES

#### PUT `/branches/:id`
Update branch
- **Permissions**: CAN_UPDATE_BRANCHES

#### DELETE `/branches/:id`
Delete branch
- **Permissions**: CAN_DELETE_BRANCHES

### Vehicle Management

#### GET `/inward`
Get all vehicle inward records
- **Permissions**: CAN_VIEW_VEHICLES

#### POST `/inward`
Create new vehicle inward
- **Permissions**: CAN_CREATE_VEHICLES

#### PUT `/inward/:id`
Update vehicle inward
- **Permissions**: CAN_UPDATE_VEHICLES

#### DELETE `/inward/:id`
Delete vehicle inward
- **Permissions**: CAN_DELETE_VEHICLES

### Customer Management

#### GET `/customers`
Get all customers
- **Permissions**: CAN_VIEW_CUSTOMERS

#### POST `/customers`
Create new customer
- **Permissions**: CAN_CREATE_CUSTOMERS

#### PUT `/customers/:id`
Update customer
- **Permissions**: CAN_UPDATE_CUSTOMERS

#### DELETE `/customers/:id`
Delete customer
- **Permissions**: CAN_DELETE_CUSTOMERS

### Booking Management

#### GET `/bookings`
Get all bookings
- **Permissions**: CAN_VIEW_BOOKINGS

#### POST `/bookings`
Create new booking
- **Permissions**: CAN_CREATE_BOOKINGS

#### PUT `/bookings/:id`
Update booking
- **Permissions**: CAN_UPDATE_BOOKINGS

#### DELETE `/bookings/:id`
Delete booking
- **Permissions**: CAN_DELETE_BOOKINGS

#### POST `/bookings/:id/generate-form`
Generate booking form PDF
- **Permissions**: CAN_GENERATE_BOOKING_FORM

### Quotation Management

#### GET `/quotations`
Get all quotations
- **Permissions**: CAN_VIEW_QUOTATIONS

#### POST `/quotations`
Create new quotation
- **Permissions**: CAN_CREATE_QUOTATIONS

#### PUT `/quotations/:id`
Update quotation
- **Permissions**: CAN_UPDATE_QUOTATIONS

#### DELETE `/quotations/:id`
Delete quotation
- **Permissions**: CAN_DELETE_QUOTATIONS

#### POST `/quotations/:id/generate-pdf`
Generate quotation PDF
- **Permissions**: CAN_GENERATE_QUOTATION_PDF

### Financial Management

#### GET `/ledger`
Get ledger entries
- **Permissions**: CAN_VIEW_LEDGER

#### POST `/ledger`
Create ledger entry
- **Permissions**: CAN_CREATE_LEDGER_ENTRIES

#### GET `/banks`
Get all banks
- **Permissions**: CAN_VIEW_BANKS

#### POST `/banks`
Create new bank
- **Permissions**: CAN_CREATE_BANKS

#### GET `/cash-locations`
Get cash locations
- **Permissions**: CAN_VIEW_CASH_LOCATIONS

#### POST `/cash-locations`
Create cash location
- **Permissions**: CAN_CREATE_CASH_LOCATIONS

### Insurance Management

#### GET `/insurance`
Get all insurance policies
- **Permissions**: CAN_VIEW_INSURANCE

#### POST `/insurance`
Create new insurance policy
- **Permissions**: CAN_CREATE_INSURANCE

#### PUT `/insurance/:id`
Update insurance policy
- **Permissions**: CAN_UPDATE_INSURANCE

#### DELETE `/insurance/:id`
Delete insurance policy
- **Permissions**: CAN_DELETE_INSURANCE

### KYC Management

#### GET `/kyc`
Get all KYC records
- **Permissions**: CAN_VIEW_KYC

#### POST `/kyc`
Create new KYC record
- **Permissions**: CAN_CREATE_KYC

#### PUT `/kyc/:id`
Update KYC record
- **Permissions**: CAN_UPDATE_KYC

#### DELETE `/kyc/:id`
Delete KYC record
- **Permissions**: CAN_DELETE_KYC

### Accessory Management

#### GET `/accessories`
Get all accessories
- **Permissions**: CAN_VIEW_ACCESSORIES

#### POST `/accessories`
Create new accessory
- **Permissions**: CAN_CREATE_ACCESSORIES

#### PUT `/accessories/:id`
Update accessory
- **Permissions**: CAN_UPDATE_ACCESSORIES

#### DELETE `/accessories/:id`
Delete accessory
- **Permissions**: CAN_DELETE_ACCESSORIES

#### GET `/accessory-categories`
Get accessory categories
- **Permissions**: CAN_VIEW_ACCESSORY_CATEGORIES

#### POST `/accessory-categories`
Create accessory category
- **Permissions**: CAN_CREATE_ACCESSORY_CATEGORIES

### File Management

#### POST `/attachments/upload`
Upload file
- **Permissions**: CAN_UPLOAD_FILES
- **File types**: Images, PDFs, Documents
- **Max size**: 10MB

#### GET `/attachments/:id`
Download file
- **Permissions**: CAN_DOWNLOAD_FILES

#### DELETE `/attachments/:id`
Delete file
- **Permissions**: CAN_DELETE_FILES

### Audit Logging

#### GET `/audit-logs`
Get audit logs
- **Permissions**: CAN_VIEW_AUDIT_LOGS
- **Filters**: Date range, user, action, module

### CSV Operations

#### POST `/csv/export`
Export data to CSV
- **Permissions**: CAN_EXPORT_DATA
- **Modules**: Customers, Vehicles, Bookings, etc.

#### POST `/csv/import`
Import data from CSV
- **Permissions**: CAN_IMPORT_DATA
- **Validation**: Required fields, data types

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)",
  "statusCode": 400
}
```

### Common HTTP Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/missing token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate data)
- **422**: Unprocessable Entity
- **500**: Internal Server Error

### Validation Errors
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## File Upload

### Supported File Types
- **Images**: JPG, JPEG, PNG, GIF
- **Documents**: PDF, DOC, DOCX, XLS, XLSX
- **Videos**: MP4, AVI, MOV

### Upload Endpoints
- `/attachments/upload`: General file upload
- `/branches/:id/logo`: Branch logo upload
- `/kyc/:id/documents`: KYC document upload
- `/insurance/:id/documents`: Insurance document upload

### File Storage
- **Local storage**: `uploads/` directory
- **Organized by**: Module and entity ID
- **Security**: File type validation, size limits

## Security Features

### Authentication
- JWT tokens with expiration
- Token blacklisting on logout
- OTP verification for sensitive operations

### Authorization
- Role-based access control (RBAC)
- Permission-based authorization
- SuperAdmin role with full access

### Security Middleware
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting
- **Input Sanitization**: XSS protection
- **MongoDB Sanitization**: NoSQL injection protection

### Data Protection
- Password hashing with bcrypt
- Sensitive data encryption
- Audit logging for all operations
- IP whitelisting capability

## Development Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Environment Variables
Create a `.env` file:
```env
NODE_ENV=development
PORT=5002
MONGODB_URI=mongodb://localhost:27017/vehicle-dealership
JWT_SECRET=your-secret-key
JWT_EXPIRE=30d
```

### Installation
```bash
# Clone repository
git clone <repository-url>
cd vehicle-dealership

# Install dependencies
npm install

# Start development server
npm run dev
```

### Database Setup
```bash
# Connect to MongoDB
mongosh

# Create database
use vehicle-dealership

# Create indexes (optional)
db.users.createIndex({ "email": 1 })
db.users.createIndex({ "mobile": 1 })
```

### API Documentation
Access Swagger documentation at:
- **Local**: http://localhost:5002/api-docs
- **Network**: http://{your-ip}:5002/api-docs

## Deployment

### Production Environment Variables
```env
NODE_ENV=production
PORT=5002
MONGODB_URI=mongodb://username:password@host:port/database
JWT_SECRET=strong-secret-key
JWT_EXPIRE=30d
CORS_ORIGIN=https://yourdomain.com
```

### PM2 Configuration
```json
{
  "name": "vehicle-dealership",
  "script": "app.js",
  "instances": "max",
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5002
CMD ["node", "app.js"]
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## API Testing

### Using Swagger UI
1. Navigate to `/api-docs`
2. Click "Authorize" and enter your JWT token
3. Test endpoints directly from the UI

### Using Postman
1. Import the Swagger JSON from `/api-docs/swagger.json`
2. Set up environment variables for base URL and tokens
3. Use the imported collection for testing

### Using curl
```bash
# Login
curl -X POST http://localhost:5002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Use token
curl -X GET http://localhost:5002/api/v1/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring and Logging

### Log Files
- **Application logs**: `logs/application-YYYY-MM-DD.log`
- **Error logs**: `logs/error-YYYY-MM-DD.log`
- **Access logs**: `logs/access-YYYY-MM-DD.log`

### Health Check
```bash
curl http://localhost:5002/health
```

### Performance Monitoring
- Request/response logging
- Database query monitoring
- Memory usage tracking
- Error rate monitoring

## Support and Maintenance

### Common Issues
1. **MongoDB connection**: Check MONGODB_URI
2. **JWT errors**: Verify JWT_SECRET
3. **File uploads**: Check disk space and permissions
4. **CORS errors**: Verify CORS configuration

### Backup Strategy
- **Database**: MongoDB dump/restore
- **Files**: Regular backup of uploads directory
- **Logs**: Log rotation and archiving

### Updates and Maintenance
- Regular security updates
- Dependency updates
- Database optimization
- Performance monitoring

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Contact**: support@dealership.com 
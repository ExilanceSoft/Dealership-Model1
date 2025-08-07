# Vehicle Dealership Database Schema Documentation

## Overview

This document provides a comprehensive overview of the database schema for the Vehicle Dealership Management System. The system uses MongoDB with Mongoose ODM for data modeling and relationships.

## Database Connection

```javascript
// config/db.js
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  });
};
```

## Core Models

### 1. User Model (`models/User.js`)

**Purpose**: Manages system users with role-based access control

```javascript
{
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      }
    }
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      }
    }
  },
  otp: String,
  otpExpires: Date,
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    validate: {
      validator: async function(roles) {
        // Role validation logic
      }
    }
  }],
  permissions: [{
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
      required: true
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    expiresAt: Date
  }],
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  discount: Number,
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `email`: Unique index
- `mobile`: Unique index
- `roles`: Index for role queries
- `branch`: Index for branch filtering

### 2. Role Model (`models/Role.js`)

**Purpose**: Defines user roles and their permissions

```javascript
{
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  is_active: {
    type: Boolean,
    default: true
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `name`: Unique index
- `permissions`: Index for permission queries

### 3. Permission Model (`models/Permission.js`)

**Purpose**: Defines system permissions

```javascript
{
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  module: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `name`: Unique index
- `module`: Index for module filtering
- `action`: Index for action filtering

### 4. Branch Model (`models/Branch.js`)

**Purpose**: Manages dealership branches

```javascript
{
  name: {
    type: String,
    required: true
  },
  address: String,
  contact: String,
  email: String,
  logo1: String,
  logo2: String,
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `name`: Index for name queries
- `is_active`: Index for active branch filtering

### 5. Vehicle Inward Model (`models/vehicleInwardModel.js`)

**Purpose**: Tracks vehicle inventory and inward processing

```javascript
{
  vehicleNumber: {
    type: String,
    required: true
  },
  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleModel',
    required: true
  },
  color: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Color',
    required: true
  },
  engineNumber: String,
  chassisNumber: String,
  keyNumber: String,
  rto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rto'
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'booked', 'sold', 'transferred'],
    default: 'available'
  },
  inwardDate: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `vehicleNumber`: Index for vehicle number queries
- `model`: Index for model filtering
- `branch`: Index for branch filtering
- `status`: Index for status filtering
- `inwardDate`: Index for date range queries

### 6. Vehicle Model (`models/VehicleModel.js`)

**Purpose**: Defines vehicle models and specifications

```javascript
{
  name: {
    type: String,
    required: true
  },
  brand: String,
  category: String,
  basePrice: Number,
  specifications: {
    engine: String,
    transmission: String,
    fuelType: String,
    mileage: String
  },
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `name`: Index for name queries
- `brand`: Index for brand filtering
- `category`: Index for category filtering

### 7. Color Model (`models/Color.js`)

**Purpose**: Manages vehicle colors

```javascript
{
  name: {
    type: String,
    required: true
  },
  code: String,
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `name`: Index for name queries
- `code`: Index for color code queries

### 8. Customer Model (`models/CustomerModel.js`)

**Purpose**: Manages customer information

```javascript
{
  name: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: true
  },
  email: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `mobile`: Index for mobile queries
- `email`: Index for email queries
- `name`: Index for name queries

### 9. Booking Model (`models/Booking.js`)

**Purpose**: Manages vehicle bookings

```javascript
{
  bookingNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'vehicleInwardModel',
    required: true
  },
  bookingAmount: {
    type: Number,
    required: true
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  accessories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accessory'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `bookingNumber`: Unique index
- `customer`: Index for customer queries
- `vehicle`: Index for vehicle queries
- `status`: Index for status filtering
- `bookingDate`: Index for date range queries

### 10. Quotation Model (`models/QuotationModel.js`)

**Purpose**: Manages vehicle quotations

```javascript
{
  quotationNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'vehicleInwardModel',
    required: true
  },
  basePrice: {
    type: Number,
    required: true
  },
  accessories: [{
    accessory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Accessory'
    },
    quantity: Number,
    price: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
    default: 'draft'
  },
  validTill: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `quotationNumber`: Unique index
- `customer`: Index for customer queries
- `vehicle`: Index for vehicle queries
- `status`: Index for status filtering
- `validTill`: Index for validity queries

### 11. Accessory Model (`models/Accessory.js`)

**Purpose**: Manages vehicle accessories

```javascript
{
  name: {
    type: String,
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccessoryCategory',
    required: true
  },
  description: String,
  price: {
    type: Number,
    required: true
  },
  stock: {
    type: Number,
    default: 0
  },
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `name`: Index for name queries
- `category`: Index for category filtering
- `price`: Index for price range queries

### 12. Accessory Category Model (`models/AccessoryCategory.js`)

**Purpose**: Categorizes accessories

```javascript
{
  name: {
    type: String,
    required: true
  },
  description: String,
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `name`: Index for name queries

### 13. Ledger Model (`models/Ledger.js`)

**Purpose**: Tracks financial transactions

```javascript
{
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  debit: Number,
  credit: Number,
  balance: Number,
  type: {
    type: String,
    enum: ['income', 'expense', 'transfer']
  },
  reference: String,
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `date`: Index for date range queries
- `type`: Index for type filtering
- `branch`: Index for branch filtering
- `balance`: Index for balance queries

### 14. Bank Model (`models/Bank.js`)

**Purpose**: Manages banking information

```javascript
{
  name: {
    type: String,
    required: true
  },
  accountNumber: String,
  ifscCode: String,
  branch: String,
  is_active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `name`: Index for name queries
- `accountNumber`: Index for account queries

### 15. Insurance Model (`models/insuranceModel.js`)

**Purpose**: Manages insurance policies

```javascript
{
  policyNumber: {
    type: String,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'vehicleInwardModel',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceProvider',
    required: true
  },
  premium: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  documents: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `policyNumber`: Index for policy queries
- `customer`: Index for customer queries
- `vehicle`: Index for vehicle queries
- `provider`: Index for provider filtering
- `status`: Index for status filtering
- `startDate`: Index for date range queries

### 16. KYC Model (`models/KYC.js`)

**Purpose**: Manages Know Your Customer documents

```javascript
{
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  documents: {
    aadharFront: String,
    aadharBack: String,
    addressProof1: String,
    addressProof2: String,
    panCard: String,
    incomeProof: String
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  remarks: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

**Indexes**:
- `customer`: Index for customer queries
- `status`: Index for status filtering

### 17. Audit Log Model (`models/AuditLog.js`)

**Purpose**: Tracks all system activities for compliance

```javascript
{
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true
  },
  entityId: String,
  entityType: String,
  oldValues: Object,
  newValues: Object,
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}
```

**Indexes**:
- `user`: Index for user queries
- `action`: Index for action filtering
- `module`: Index for module filtering
- `timestamp`: Index for date range queries
- `entityId`: Index for entity queries

## Model Relationships

### One-to-Many Relationships
- **User → Branch**: A user belongs to one branch
- **Branch → Users**: A branch can have multiple users
- **Vehicle → Branch**: A vehicle belongs to one branch
- **Customer → Bookings**: A customer can have multiple bookings
- **Vehicle → Bookings**: A vehicle can have multiple bookings
- **User → AuditLogs**: A user can have multiple audit logs

### Many-to-Many Relationships
- **User ↔ Role**: Users can have multiple roles, roles can have multiple users
- **Role ↔ Permission**: Roles can have multiple permissions, permissions can be in multiple roles
- **Booking ↔ Accessory**: Bookings can have multiple accessories, accessories can be in multiple bookings
- **Quotation ↔ Accessory**: Quotations can have multiple accessories, accessories can be in multiple quotations

### Hierarchical Relationships
- **AccessoryCategory → Accessory**: Categories contain multiple accessories
- **VehicleModel → Vehicle**: Models can have multiple vehicles

## Database Indexes

### Performance Indexes
```javascript
// User indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "mobile": 1 }, { unique: true });
db.users.createIndex({ "roles": 1 });
db.users.createIndex({ "branch": 1 });

// Vehicle indexes
db.vehicleinwards.createIndex({ "vehicleNumber": 1 });
db.vehicleinwards.createIndex({ "model": 1 });
db.vehicleinwards.createIndex({ "branch": 1 });
db.vehicleinwards.createIndex({ "status": 1 });

// Booking indexes
db.bookings.createIndex({ "bookingNumber": 1 }, { unique: true });
db.bookings.createIndex({ "customer": 1 });
db.bookings.createIndex({ "vehicle": 1 });
db.bookings.createIndex({ "status": 1 });

// Quotation indexes
db.quotations.createIndex({ "quotationNumber": 1 }, { unique: true });
db.quotations.createIndex({ "customer": 1 });
db.quotations.createIndex({ "vehicle": 1 });
db.quotations.createIndex({ "status": 1 });

// Ledger indexes
db.ledgers.createIndex({ "date": 1 });
db.ledgers.createIndex({ "branch": 1 });
db.ledgers.createIndex({ "type": 1 });

// Audit log indexes
db.auditlogs.createIndex({ "user": 1 });
db.auditlogs.createIndex({ "timestamp": 1 });
db.auditlogs.createIndex({ "module": 1 });
db.auditlogs.createIndex({ "action": 1 });
```

## Data Validation

### Mongoose Validation
- **Email validation**: Regex pattern for valid email format
- **Mobile validation**: Indian mobile number format (6-9 followed by 9 digits)
- **Required fields**: Essential fields marked as required
- **Enum validation**: Status fields with predefined values
- **Reference validation**: Foreign key relationships validated

### Custom Validation
- **Role validation**: Ensures assigned roles exist and are active
- **Permission validation**: Validates user permissions before operations
- **Business logic validation**: Custom validators for business rules

## Data Integrity

### Referential Integrity
- **Cascade updates**: When parent records are updated, child records are updated
- **Cascade deletes**: When parent records are deleted, child records are handled appropriately
- **Soft deletes**: Records are marked as inactive rather than physically deleted

### Transaction Support
- **Atomic operations**: Critical operations wrapped in transactions
- **Rollback capability**: Failed operations can be rolled back
- **Consistency checks**: Regular consistency validation

## Backup and Recovery

### Backup Strategy
```bash
# Database backup
mongodump --uri="mongodb://localhost:27017/vehicle-dealership" --out=/backup/path

# Restore database
mongorestore --uri="mongodb://localhost:27017/vehicle-dealership" /backup/path
```

### Data Export
```javascript
// Export specific collections
db.users.find().forEach(function(doc) {
  printjson(doc);
});

// Export with filters
db.bookings.find({status: "confirmed"}).forEach(function(doc) {
  printjson(doc);
});
```

## Performance Optimization

### Query Optimization
- **Index usage**: Proper indexes for frequently queried fields
- **Aggregation pipelines**: Efficient data aggregation
- **Pagination**: Large datasets paginated for performance
- **Caching**: Frequently accessed data cached

### Monitoring
- **Query performance**: Monitor slow queries
- **Index usage**: Track index effectiveness
- **Connection pooling**: Optimize database connections
- **Memory usage**: Monitor memory consumption

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Database**: MongoDB 4.4+  
**ODM**: Mongoose 8.16.0 
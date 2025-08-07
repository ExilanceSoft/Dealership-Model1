# Vehicle Dealership API Endpoints Documentation

## Base URL
```
http://localhost:5002/api/v1
```

## Authentication

All API endpoints (except authentication endpoints) require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 1. Authentication Endpoints

### 1.1 Register User
**POST** `/auth/register`

**Description**: Register a new user. First user becomes SuperAdmin.

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "roleId": "507f1f77bcf86cd799439011",
  "branch": "507f1f77bcf86cd799439012",
  "discount": 100
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "OTP sent to mobile for verification",
  "isSuperAdmin": false,
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "9876543210",
    "role": "SALES_EXECUTIVE",
    "discount": 100
  }
}
```

### 1.2 Login User
**POST** `/auth/login`

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "roles": ["SALES_EXECUTIVE"],
    "branch": "507f1f77bcf86cd799439012"
  }
}
```

### 1.3 Verify OTP
**POST** `/auth/verify-otp`

**Request Body**:
```json
{
  "mobile": "9876543210",
  "otp": "123456"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 1.4 Logout
**POST** `/auth/logout`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## 2. User Management

### 2.1 Get All Users
**GET** `/users`

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search by name, email, or mobile
- `role`: Filter by role ID
- `branch`: Filter by branch ID
- `status`: Filter by active status

**Response** (200):
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com",
        "mobile": "9876543210",
        "roles": [
          {
            "id": "507f1f77bcf86cd799439013",
            "name": "SALES_EXECUTIVE"
          }
        ],
        "branch": {
          "id": "507f1f77bcf86cd799439012",
          "name": "Mumbai Central"
        },
        "is_active": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

### 2.2 Create User
**POST** `/users`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "mobile": "9876543211",
  "roleId": "507f1f77bcf86cd799439013",
  "branch": "507f1f77bcf86cd799439012",
  "discount": 150
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439014",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "mobile": "9876543211"
  }
}
```

### 2.3 Get User by ID
**GET** `/users/:id`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "9876543210",
    "roles": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "SALES_EXECUTIVE",
        "permissions": [
          "CAN_VIEW_CUSTOMERS",
          "CAN_CREATE_BOOKINGS"
        ]
      }
    ],
    "branch": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Mumbai Central"
    },
    "discount": 100,
    "is_active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2.4 Update User
**PUT** `/users/:id`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "name": "John Updated",
  "email": "john.updated@example.com",
  "discount": 200
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Updated",
    "email": "john.updated@example.com"
  }
}
```

### 2.5 Delete User
**DELETE** `/users/:id`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

## 3. Vehicle Management

### 3.1 Get All Vehicles
**GET** `/inward`

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search by vehicle number, engine number, or chassis number
- `model`: Filter by vehicle model ID
- `color`: Filter by color ID
- `branch`: Filter by branch ID
- `status`: Filter by status (available, booked, sold, transferred)
- `dateFrom`: Filter by inward date from
- `dateTo`: Filter by inward date to

**Response** (200):
```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "id": "507f1f77bcf86cd799439015",
        "vehicleNumber": "MH01AB1234",
        "model": {
          "id": "507f1f77bcf86cd799439016",
          "name": "TVS Jupiter",
          "brand": "TVS"
        },
        "color": {
          "id": "507f1f77bcf86cd799439017",
          "name": "Red",
          "code": "#FF0000"
        },
        "engineNumber": "ENG123456",
        "chassisNumber": "CHS789012",
        "keyNumber": "KEY345678",
        "rto": {
          "id": "507f1f77bcf86cd799439018",
          "name": "Mumbai Central"
        },
        "branch": {
          "id": "507f1f77bcf86cd799439012",
          "name": "Mumbai Central"
        },
        "status": "available",
        "inwardDate": "2024-01-01T00:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    }
  }
}
```

### 3.2 Create Vehicle
**POST** `/inward`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "vehicleNumber": "MH01AB1234",
  "model": "507f1f77bcf86cd799439016",
  "color": "507f1f77bcf86cd799439017",
  "engineNumber": "ENG123456",
  "chassisNumber": "CHS789012",
  "keyNumber": "KEY345678",
  "rto": "507f1f77bcf86cd799439018",
  "branch": "507f1f77bcf86cd799439012"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Vehicle created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "vehicleNumber": "MH01AB1234",
    "status": "available"
  }
}
```

### 3.3 Update Vehicle
**PUT** `/inward/:id`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "status": "booked",
  "engineNumber": "ENG123456_UPDATED"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Vehicle updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "status": "booked"
  }
}
```

## 4. Customer Management

### 4.1 Get All Customers
**GET** `/customers`

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search by name, mobile, or email
- `city`: Filter by city
- `state`: Filter by state

**Response** (200):
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "507f1f77bcf86cd799439019",
        "name": "Alice Johnson",
        "mobile": "9876543210",
        "email": "alice@example.com",
        "address": "123 Main Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 30,
      "pages": 3
    }
  }
}
```

### 4.2 Create Customer
**POST** `/customers`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "name": "Bob Wilson",
  "mobile": "9876543211",
  "email": "bob@example.com",
  "address": "456 Oak Avenue",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400002"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "name": "Bob Wilson",
    "mobile": "9876543211"
  }
}
```

## 5. Booking Management

### 5.1 Get All Bookings
**GET** `/bookings`

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search by booking number
- `customer`: Filter by customer ID
- `vehicle`: Filter by vehicle ID
- `status`: Filter by status (pending, confirmed, cancelled, completed)
- `dateFrom`: Filter by booking date from
- `dateTo`: Filter by booking date to

**Response** (200):
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "507f1f77bcf86cd799439021",
        "bookingNumber": "BK000001",
        "customer": {
          "id": "507f1f77bcf86cd799439019",
          "name": "Alice Johnson",
          "mobile": "9876543210"
        },
        "vehicle": {
          "id": "507f1f77bcf86cd799439015",
          "vehicleNumber": "MH01AB1234",
          "model": {
            "name": "TVS Jupiter"
          }
        },
        "bookingAmount": 50000,
        "bookingDate": "2024-01-01T00:00:00.000Z",
        "status": "confirmed",
        "accessories": [
          {
            "id": "507f1f77bcf86cd799439022",
            "name": "Helmet",
            "price": 1000
          }
        ],
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 20,
      "pages": 2
    }
  }
}
```

### 5.2 Create Booking
**POST** `/bookings`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "customer": "507f1f77bcf86cd799439019",
  "vehicle": "507f1f77bcf86cd799439015",
  "bookingAmount": 50000,
  "accessories": [
    {
      "accessory": "507f1f77bcf86cd799439022",
      "quantity": 1,
      "price": 1000
    }
  ]
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439021",
    "bookingNumber": "BK000001",
    "status": "pending"
  }
}
```

### 5.3 Generate Booking Form
**POST** `/bookings/:id/generate-form`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "success": true,
  "message": "Booking form generated successfully",
  "data": {
    "formUrl": "/uploads/booking-forms/booking-form-BK000001-1753355361187.html"
  }
}
```

## 6. Quotation Management

### 6.1 Get All Quotations
**GET** `/quotations`

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search by quotation number
- `customer`: Filter by customer ID
- `vehicle`: Filter by vehicle ID
- `status`: Filter by status (draft, sent, accepted, rejected, expired)
- `dateFrom`: Filter by creation date from
- `dateTo`: Filter by creation date to

**Response** (200):
```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "id": "507f1f77bcf86cd799439023",
        "quotationNumber": "QT000001",
        "customer": {
          "id": "507f1f77bcf86cd799439019",
          "name": "Alice Johnson",
          "mobile": "9876543210"
        },
        "vehicle": {
          "id": "507f1f77bcf86cd799439015",
          "vehicleNumber": "MH01AB1234",
          "model": {
            "name": "TVS Jupiter"
          }
        },
        "basePrice": 45000,
        "accessories": [
          {
            "accessory": {
              "id": "507f1f77bcf86cd799439022",
              "name": "Helmet"
            },
            "quantity": 1,
            "price": 1000
          }
        ],
        "totalAmount": 46000,
        "status": "sent",
        "validTill": "2024-02-01T00:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "pages": 2
    }
  }
}
```

### 6.2 Create Quotation
**POST** `/quotations`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "customer": "507f1f77bcf86cd799439019",
  "vehicle": "507f1f77bcf86cd799439015",
  "basePrice": 45000,
  "accessories": [
    {
      "accessory": "507f1f77bcf86cd799439022",
      "quantity": 1,
      "price": 1000
    }
  ],
  "totalAmount": 46000,
  "validTill": "2024-02-01T00:00:00.000Z"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Quotation created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439023",
    "quotationNumber": "QT000001",
    "status": "draft"
  }
}
```

### 6.3 Generate Quotation PDF
**POST** `/quotations/:id/generate-pdf`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "success": true,
  "message": "Quotation PDF generated successfully",
  "data": {
    "pdfUrl": "/public/quotations/quotation_QT000001_1753872632910.pdf"
  }
}
```

## 7. Financial Management

### 7.1 Get Ledger Entries
**GET** `/ledger`

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `dateFrom`: Filter by date from
- `dateTo`: Filter by date to
- `type`: Filter by type (income, expense, transfer)
- `branch`: Filter by branch ID

**Response** (200):
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "507f1f77bcf86cd799439024",
        "date": "2024-01-01T00:00:00.000Z",
        "description": "Vehicle Sale - MH01AB1234",
        "debit": 0,
        "credit": 50000,
        "balance": 50000,
        "type": "income",
        "reference": "BK000001",
        "branch": {
          "id": "507f1f77bcf86cd799439012",
          "name": "Mumbai Central"
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    },
    "summary": {
      "totalDebit": 25000,
      "totalCredit": 75000,
      "netBalance": 50000
    }
  }
}
```

### 7.2 Create Ledger Entry
**POST** `/ledger`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "date": "2024-01-01T00:00:00.000Z",
  "description": "Vehicle Sale - MH01AB1234",
  "debit": 0,
  "credit": 50000,
  "type": "income",
  "reference": "BK000001",
  "branch": "507f1f77bcf86cd799439012"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Ledger entry created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439024",
    "balance": 50000
  }
}
```

## 8. File Management

### 8.1 Upload File
**POST** `/attachments/upload`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data**:
- `file`: File to upload (max 10MB)
- `module`: Module name (e.g., "kyc", "insurance", "branch")
- `entityId`: Entity ID (optional)

**Response** (201):
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": "507f1f77bcf86cd799439025",
    "filename": "document.pdf",
    "originalName": "customer_document.pdf",
    "mimeType": "application/pdf",
    "size": 1024000,
    "url": "/api/v1/uploads/attachments/attch-1749875482468-m7ydm.pdf"
  }
}
```

### 8.2 Download File
**GET** `/attachments/:id`

**Headers**:
```
Authorization: Bearer <token>
```

**Response**: File download

### 8.3 Delete File
**DELETE** `/attachments/:id`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

## 9. CSV Operations

### 9.1 Export Data
**POST** `/csv/export`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "module": "customers",
  "filters": {
    "city": "Mumbai",
    "dateFrom": "2024-01-01T00:00:00.000Z",
    "dateTo": "2024-01-31T23:59:59.000Z"
  },
  "fields": ["name", "mobile", "email", "city", "state"]
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Data exported successfully",
  "data": {
    "downloadUrl": "/uploads/1749881036660-exported_data_EV.csv",
    "filename": "customers_export_20240101.csv",
    "recordCount": 150
  }
}
```

### 9.2 Import Data
**POST** `/csv/import`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data**:
- `file`: CSV file to import
- `module`: Module name (e.g., "customers", "vehicles")
- `options`: Import options (JSON string)

**Response** (200):
```json
{
  "success": true,
  "message": "Data imported successfully",
  "data": {
    "totalRecords": 100,
    "importedRecords": 95,
    "failedRecords": 5,
    "errors": [
      {
        "row": 3,
        "field": "email",
        "error": "Invalid email format"
      }
    ]
  }
}
```

## 10. Audit Logging

### 10.1 Get Audit Logs
**GET** `/audit-logs`

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `user`: Filter by user ID
- `action`: Filter by action
- `module`: Filter by module
- `dateFrom`: Filter by timestamp from
- `dateTo`: Filter by timestamp to

**Response** (200):
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "507f1f77bcf86cd799439026",
        "user": {
          "id": "507f1f77bcf86cd799439011",
          "name": "John Doe"
        },
        "action": "CREATE",
        "module": "customers",
        "entityId": "507f1f77bcf86cd799439019",
        "entityType": "Customer",
        "oldValues": null,
        "newValues": {
          "name": "Alice Johnson",
          "mobile": "9876543210"
        },
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 500,
      "pages": 50
    }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "mobile",
      "message": "Mobile number must be 10 digits"
    }
  ],
  "statusCode": 400
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "statusCode": 401
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "statusCode": 403
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found",
  "statusCode": 404
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Email already exists",
  "statusCode": 409
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error",
  "error": "Detailed error message (development only)",
  "statusCode": 500
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **Authentication endpoints**: 5 requests per minute
- **General endpoints**: 100 requests per minute
- **File upload endpoints**: 10 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Pagination

All list endpoints support pagination with the following response format:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## Search and Filtering

Most endpoints support search and filtering:
- **Search**: Text search across relevant fields
- **Filters**: Specific field filtering
- **Date ranges**: Date-based filtering
- **Status filtering**: Filter by status fields
- **Relationship filtering**: Filter by related entities

## File Upload Limits

- **Maximum file size**: 10MB
- **Supported formats**: JPG, JPEG, PNG, GIF, PDF, DOC, DOCX, XLS, XLSX, MP4, AVI, MOV
- **Storage**: Local file system with organized directory structure
- **Security**: File type validation and virus scanning

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Base URL**: http://localhost:5002/api/v1 
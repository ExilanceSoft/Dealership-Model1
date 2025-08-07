# Vehicle Inward CSV Import/Export Guide

## Overview
This document describes how to use the new CSV import/export functionality for vehicle inward records, including support for the new CSD (Commercial Service Delivery) vehicle type.

## Vehicle Types Supported
- **EV**: Electric Vehicles
- **ICE**: Internal Combustion Engine vehicles
- **CSD**: Commercial Service Delivery vehicles

## API Endpoints

### 1. Export CSV Template
**GET** `/api/v1/inward/export-csv`

**Query Parameters:**
- `type` (required): EV, ICE, or CSD
- `branch_id` (required): Branch ID for filtering

**Example:**
```
GET /api/v1/inward/export-csv?type=CSD&branch_id=507f1f77bcf86cd799439011
```

**Response:** CSV file download with all vehicle inward records of the specified type.

### 2. Import CSV
**POST** `/api/v1/inward/import-csv`

**Headers:**
- `Content-Type: multipart/form-data`
- `Authorization: Bearer <token>`

**Body:**
- `file`: CSV file to import

**Example using curl:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@vehicle_inward.csv" \
  http://localhost:3000/api/v1/inward/import-csv
```

## CSV Format

### Required Columns
- `model_name`: Model name (will be created if doesn't exist)
- `branch_name`: Branch name (will be looked up by name)
- `type`: EV, ICE, or CSD
- `colors`: Color names separated by pipe (|) (will be created if don't exist)
- `chassisNumber`: Unique chassis number

### Optional Columns
- `batteryNumber`: Battery number (for EVs)
- `keyNumber`: Key number
- `motorNumber`: Motor number (for EVs)
- `chargerNumber`: Charger number (for EVs)
- `engineNumber`: Engine number (for ICE/CSD)
- `hasDamage`: true/false
- `status`: in_stock, in_transit, sold, service, damaged

### Sample CSV
```csv
model_name,branch_name,type,colors,batteryNumber,keyNumber,chassisNumber,motorNumber,chargerNumber,engineNumber,hasDamage,status
Tesla Model S,Mumbai Branch,EV,Red|Blue,BATT001,KEY001,CHS1234567890,MOTOR001,CHARGER001,,false,in_stock
Toyota Camry,Mumbai Branch,ICE,White|Black,,KEY002,CHS1234567891,,,ENG001,false,in_stock
Ford Transit,Mumbai Branch,CSD,Silver|Gray,,KEY003,CHS1234567892,,,ENG002,false,in_stock
```

**Note:** The CSV will contain only vehicles from the selected branch and type. All vehicles in the CSV will have the same branch_name.

## Validation Rules

### Vehicle Type Validation
- Must be one of: EV, ICE, CSD
- Case-insensitive (will be converted to uppercase)

### Required Fields
- model, unloadLocation, type, colors, chassisNumber are required
- Other fields are optional

### Branch Validation
- branch_name must match an existing branch name
- When importing, the branch_name must match the branch that was used for export
- model_name and colors will be automatically created if they don't exist

### Chassis Number Validation
- Must be unique across all vehicles
- Will be converted to uppercase

## Error Handling

### Import Errors
The API returns detailed error information:
```json
{
  "status": "success",
  "message": "CSV import completed",
  "imported": 5,
  "updated": 2,
  "errors": [
    "Row 3: Missing required fields",
    "Row 7: Invalid model or location ID"
  ]
}
```

### Common Error Scenarios
1. **Missing required fields**: model_name, branch_name, type, colors, chassisNumber
2. **Invalid vehicle type**: Must be EV, ICE, or CSD
3. **Branch not found**: branch_name must match an existing branch
4. **Branch mismatch**: branch_name must match the export branch
5. **Duplicate chassis number**: Chassis number already exists
6. **Invalid status**: Must be one of the valid status values

## Usage Examples

### 1. Export CSD Vehicles
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/inward/export-csv?type=CSD&branch_id=507f1f77bcf86cd799439011" \
  -o csd_vehicles.csv
```

### 2. Import Vehicle Inward Records
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@vehicle_inward.csv" \
  http://localhost:3000/api/v1/inward/import-csv
```

### 3. Get All CSD Vehicles
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/inward?type=CSD"
```

## Database Schema Updates

### VehicleInwardModel Schema
Updated enum:
```javascript
type: {
  type: String,
  required: [true, 'Vehicle type is required (EV/ICE/CSD)'],
  enum: ['EV', 'ICE', 'CSD'],
  uppercase: true
}
```

## Field Descriptions

### Required Fields
- **model_name**: Model name (will be created if doesn't exist)
- **branch_name**: Branch name (will be looked up by name)
- **type**: Vehicle type (EV/ICE/CSD)
- **colors**: Color names separated by pipe (|) (will be created if don't exist)
- **chassisNumber**: Unique chassis number for the vehicle

### Optional Fields
- **batteryNumber**: Battery number (typically for EVs)
- **keyNumber**: Key number for the vehicle
- **motorNumber**: Motor number (typically for EVs)
- **chargerNumber**: Charger number (typically for EVs)
- **engineNumber**: Engine number (typically for ICE/CSD vehicles)
- **hasDamage**: Boolean indicating if vehicle has damage
- **status**: Current status of the vehicle

### Type-Specific Fields
- **EV (Electric Vehicle)**: batteryNumber, motorNumber, chargerNumber
- **ICE (Internal Combustion Engine)**: engineNumber
- **CSD (Commercial Service Delivery)**: engineNumber

## Status Values
- `in_stock`: Vehicle is in stock
- `in_transit`: Vehicle is in transit
- `sold`: Vehicle has been sold
- `service`: Vehicle is in service
- `damaged`: Vehicle has damage

## Security
- CSV import/export requires ADMIN, INVENTORY_MANAGER, or SUPERADMIN privileges
- All operations are logged for audit purposes
- File upload is restricted to CSV files only
- Maximum file size is enforced

## Best Practices
1. Always validate CSV format before importing
2. Use the export template as a starting point
3. Test with small datasets first
4. Review error logs for any issues
5. Backup existing data before bulk imports
6. Use meaningful chassis numbers for easy identification
7. Ensure branch name exists in the system before import
8. Use descriptive model and color names
9. Models and colors will be automatically created if they don't exist

## CSV Import Process
1. **Validation**: Check required fields and data formats
2. **Branch Lookup**: Find branch by name
3. **Model Creation**: Create models if they don't exist
4. **Color Creation**: Create colors if they don't exist
5. **Duplicate Check**: Check for existing chassis numbers
6. **Import/Update**: Create new records or update existing ones
7. **Error Reporting**: Return detailed error information

## CSV Export Process
1. **Filter**: Filter vehicles by type and branch
2. **Populate**: Load related model and color information
3. **Format**: Convert data to CSV format with single branch name
4. **Download**: Stream CSV file to client

**Note:** The exported CSV will contain only vehicles from the specified branch and type. All vehicles will have the same branch_name.

## Troubleshooting

### Common Issues
1. **Branch not found**: Ensure branch name exists in the system
2. **Missing References**: Verify branch exists
3. **Duplicate Chassis Numbers**: Each chassis number must be unique
4. **Invalid Vehicle Type**: Must be EV, ICE, or CSD
5. **Invalid Status**: Must be one of the valid status values

### Error Messages
- "Missing required fields": Check that all required columns are present
- "Branch 'X' does not exist": Verify branch name exists in the system
- "Branch 'X' does not match the export branch": Ensure you're importing to the correct branch
- "Vehicle with chassis number X already exists": Use a unique chassis number 
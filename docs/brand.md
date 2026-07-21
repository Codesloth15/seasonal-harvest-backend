# Brand Module

The **Brand Module** manages product brands within the Seasonal Harvest backend. A brand represents the manufacturer or company of a product, such as **CDO**, **Purefoods**, **Virginia**, or **Bounty Fresh**.

Products reference a brand through the `brand_id` foreign key.

---

# Purpose

The Brand Module allows administrators to:

- Create new brands
- View all brands
- View a specific brand
- Update brand information
- Disable or delete brands (depending on implementation)

This ensures products are organized and grouped by their manufacturers.

---

# Database Structure

Table: `brands`

| Column | Type | Description |
|----------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Brand name |
| logo_url | TEXT | Brand logo image |
| is_active | BOOLEAN | Brand status |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last updated |

---

# API Endpoints

Base URL

```
/api/v1/brands
```

---

## Get All Brands

Returns every brand.

### Request

```
GET /api/v1/brands
```

### Response

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "...",
      "name": "CDO",
      "logo_url": "...",
      "is_active": true
    }
  ]
}
```

---

## Get Brand By ID

Returns a single brand.

### Request

```
GET /api/v1/brands/:id
```

Example

```
GET /api/v1/brands/de63c12b-dede-4856-8599-26094c6e1073
```

---

## Create Brand

Creates a new brand.

### Request

```
POST /api/v1/brands
```

### Body

```json
{
    "name": "CDO",
    "logo_url": "https://example.com/cdo.png",
    "is_active": true
}
```

### Response

```json
{
    "success": true,
    "message": "Brand created successfully.",
    "data": {
        "id": "...",
        "name": "CDO"
    }
}
```

---

## Update Brand

Updates an existing brand.

### Request

```
PUT /api/v1/brands/:id
```

Example

```
PUT /api/v1/brands/de63c12b-dede-4856-8599-26094c6e1073
```

### Body

```json
{
    "name": "CDO Foods",
    "logo_url": "https://example.com/new-logo.png",
    "is_active": true
}
```

---

## Delete Brand

Deletes or disables a brand.

### Request

```
DELETE /api/v1/brands/:id
```

---

# Project Structure

```
src/
│
├── controller/
│   └── brand.controller.js
│
├── model/
│   └── brand.model.js
│
├── routes/
│   └── brand.route.js
│
└── app.js
```

---

# Request Flow

```
Client
   │
   ▼
Brand Routes
   │
   ▼
Brand Controller
   │
   ▼
Brand Model
   │
   ▼
Supabase Database
```

---

# Example Workflow

### Create

```
POST /api/v1/brands
```

↓

Controller validates request.

↓

Model inserts the brand into Supabase.

↓

Supabase returns the created brand.

↓

Controller returns JSON response.

---

### Get All

```
GET /api/v1/brands
```

↓

Controller calls Model.

↓

Model retrieves every brand.

↓

Controller returns list of brands.

---

### Update

```
PUT /api/v1/brands/:id
```

↓

Controller receives the ID.

↓

Model updates the record.

↓

Supabase returns updated data.

↓

Controller sends success response.

---

# Notes

- Every product references a brand using `brand_id`.
- `created_at` should be generated automatically by the database.
- `updated_at` should be updated whenever the brand changes.
- `is_active` can be used for soft deletion or hiding brands without removing them from the database.

---

# Recommended Usage

✔ Use **GET** endpoints in customer and admin applications.

✔ Restrict **POST**, **PUT**, and **DELETE** endpoints to authenticated administrators.

✔ Do not allow customers to create or modify brands.

---

# Future Improvements

- Brand search
- Brand pagination
- Brand logo upload using Firebase Storage
- Soft delete support
- Audit logs for brand updates
- Role-based authorization
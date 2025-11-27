# Inventory Management System

Advanced Department Equipment & Stationery Inventory Management System with MongoDB backend.

## Features

- **Dashboard**: Overview of inventory status, usage trends, and alerts
- **Inventory Management**: Add, edit, delete, and track inventory items
- **Usage Tracking**: Record and analyze item usage patterns
- **Stock Forecasting**: Predict stockouts and generate order recommendations
- **Supplier Management**: Manage supplier information and contacts
- **Audit Log**: Track all system activities
- **Reports**: Generate and export reports in Excel/PDF format

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with Mongoose ODM)

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)

### Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Mlabs_bootcamp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your MongoDB connection string:
   ```
   MONGODB_URI=mongodb://localhost:27017/inventory_db
   PORT=3000
   ```

   For MongoDB Atlas, use:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/inventory_db
   ```

5. Start the server:
   ```bash
   npm start
   ```

6. Open your browser and navigate to `http://localhost:3000`

## Development

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Inventory
- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/:id` - Get single inventory item
- `POST /api/inventory` - Create new inventory item
- `PATCH /api/inventory/:id` - Update inventory item
- `PATCH /api/inventory/:id/restock` - Restock inventory item
- `DELETE /api/inventory/:id` - Delete inventory item

### Usage
- `GET /api/usage` - Get all usage records
- `GET /api/usage/item/:itemId` - Get usage records for specific item
- `POST /api/usage` - Record new usage
- `DELETE /api/usage/:id` - Delete usage record

### Suppliers
- `GET /api/suppliers` - Get all suppliers
- `GET /api/suppliers/:id` - Get single supplier
- `POST /api/suppliers` - Create new supplier
- `PATCH /api/suppliers/:id` - Update supplier
- `DELETE /api/suppliers/:id` - Delete supplier

### Audit Log
- `GET /api/audit` - Get all audit logs
- `GET /api/audit/filter` - Get filtered audit logs
- `POST /api/audit` - Create audit log entry

## Deployment

### Vercel

The project includes `vercel.json` for easy deployment to Vercel:

1. Install Vercel CLI: `npm i -g vercel`
2. Set up your MongoDB Atlas cluster
3. Add `MONGODB_URI` to your Vercel environment variables
4. Deploy: `vercel`

## License

MIT

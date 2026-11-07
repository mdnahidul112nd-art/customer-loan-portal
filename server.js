const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const LOGOS_FILE = path.join(DATA_DIR, 'logos.json');

// Ensure directories and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(CUSTOMERS_FILE)) fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(LOGOS_FILE)) fs.writeFileSync(LOGOS_FILE, JSON.stringify([], null, 2));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static file servers
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = 'logo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + ext;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper functions for reading/writing JSON files
function readJSON(filePath, fallback = []) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return fallback;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

// Generate random alphanumeric token for link
function generateRandomToken(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Auth credentials (default)
const ADMIN_CREDENTIALS = {
  adminId: 'admin',
  password: 'admin'
};

// Simple auth middleware
function checkAuth(req, res, next) {
  const authToken = req.cookies['admin_session'];
  if (authToken === 'authorized_admin_session_token') {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// ======================== API ROUTES ======================== //

// 1. Admin Authentication
app.post('/api/auth/login', (req, res) => {
  const { adminId, password } = req.body;
  if (adminId === ADMIN_CREDENTIALS.adminId && password === ADMIN_CREDENTIALS.password) {
    res.cookie('admin_session', 'authorized_admin_session_token', {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    return res.json({ success: true, message: 'Logged in successfully' });
  }
  return res.status(401).json({ success: false, error: 'Invalid Admin ID or Password' });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('admin_session');
  return res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req, res) => {
  const authToken = req.cookies['admin_session'];
  if (authToken === 'authorized_admin_session_token') {
    return res.json({ loggedIn: true, adminId: ADMIN_CREDENTIALS.adminId });
  }
  return res.json({ loggedIn: false });
});

// 2. Logos API
app.get('/api/logos', (req, res) => {
  const logos = readJSON(LOGOS_FILE, []);
  res.json({ logos, total: logos.length });
});

app.post('/api/logos/upload', upload.single('logoFile'), (req, res) => {
  try {
    const { appName } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const logos = readJSON(LOGOS_FILE, []);
    const newLogo = {
      id: 'logo_' + Date.now(),
      name: appName || path.parse(req.file.originalname).name,
      icon: '/uploads/' + req.file.filename
    };
    logos.push(newLogo);
    writeJSON(LOGOS_FILE, logos);
    return res.json({ success: true, logo: newLogo, total: logos.length });
  } catch (err) {
    console.error('Logo upload error:', err);
    return res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// 3. Customer APIs
app.get('/api/customers', checkAuth, (req, res) => {
  const customers = readJSON(CUSTOMERS_FILE, []);
  res.json({ customers });
});

app.post('/api/customers', checkAuth, (req, res) => {
  try {
    const data = req.body;
    const customers = readJSON(CUSTOMERS_FILE, []);

    const token = generateRandomToken(7);
    const repaymentAmount = parseFloat(data.repaymentAmount) || 0;
    const loanAmount = parseFloat(data.loanAmount) || repaymentAmount;

    const newCustomer = {
      id: 'cust_' + Date.now(),
      token: token,
      appName: data.appName || 'Zen Money',
      appLogo: data.appLogo || '/assets/zen-money.svg',
      customerName: data.customerName || 'Customer Name',
      repaymentAmount: repaymentAmount,
      loanAmount: loanAmount,
      receivedAmount: parseFloat(data.receivedAmount) || loanAmount,
      bankAddress: data.bankAddress || '',
      amountPaid: parseFloat(data.amountPaid) || 0,
      overdueDays: parseInt(data.overdueDays, 10) || 0,
      lateFee: parseFloat(data.lateFee) || 0,
      amountReceivedDate: data.amountReceivedDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || new Date().toISOString().split('T')[0],
      renewalDays: parseInt(data.renewalDays, 10) || 7,
      renewalFee: parseFloat(data.renewalFee) || Math.round(loanAmount * 0.4),
      upiId: data.upiId || 'Q609224859@ybl',
      merchantName: data.merchantName || (data.appName || 'Zen Money'),
      status: 'Pending',
      submittedUtr: null,
      utrSubmittedAt: null,
      createdAt: new Date().toISOString()
    };

    customers.unshift(newCustomer);
    writeJSON(CUSTOMERS_FILE, customers);

    return res.json({
      success: true,
      customer: newCustomer,
      link: `/pay/${token}`
    });
  } catch (err) {
    console.error('Error creating customer:', err);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Get customer by random token (public for customer view)
app.get('/api/customers/:token', (req, res) => {
  const { token } = req.params;
  const customers = readJSON(CUSTOMERS_FILE, []);
  const customer = customers.find(c => c.token === token || c.id === token);

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found or invalid link' });
  }

  // Calculate dynamic 40% renew amount
  const renewAmount = Math.round(customer.repaymentAmount * 0.4);

  return res.json({
    customer: {
      ...customer,
      calculatedRenewAmount: renewAmount
    }
  });
});

// Update customer
app.put('/api/customers/:id', checkAuth, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const customers = readJSON(CUSTOMERS_FILE, []);
    const index = customers.findIndex(c => c.id === id || c.token === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    customers[index] = {
      ...customers[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    writeJSON(CUSTOMERS_FILE, customers);
    return res.json({ success: true, customer: customers[index] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
app.delete('/api/customers/:id', checkAuth, (req, res) => {
  const { id } = req.params;
  let customers = readJSON(CUSTOMERS_FILE, []);
  customers = customers.filter(c => c.id !== id && c.token !== id);
  writeJSON(CUSTOMERS_FILE, customers);
  return res.json({ success: true });
});

// 4. Submit UTR (from customer page)
app.post('/api/customers/:token/submit-utr', (req, res) => {
  const { token } = req.params;
  const { utr } = req.body;

  if (!utr || !/^\d{12}$/.test(utr.trim())) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit numeric UTR' });
  }

  const customers = readJSON(CUSTOMERS_FILE, []);
  const index = customers.findIndex(c => c.token === token || c.id === token);

  if (index === -1) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  customers[index].submittedUtr = utr.trim();
  customers[index].utrSubmittedAt = new Date().toISOString();
  customers[index].status = 'UTR Submitted';

  writeJSON(CUSTOMERS_FILE, customers);
  return res.json({
    success: true,
    message: 'UTR submitted successfully! Verification in progress.',
    utr: utr.trim()
  });
});

// 5. Dynamic QR Code API (generates QR code from UPI string)
app.get('/api/qrcode', async (req, res) => {
  try {
    const { upi, amount, name } = req.query;
    if (!upi) return res.status(400).send('UPI ID is required');

    // Standard UPI deep link format
    const upiUri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name || 'Merchant')}&am=${encodeURIComponent(amount || '')}&cu=INR&tn=Payment`;

    const qrDataUrl = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 280,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.json({ qrDataUrl, upiUri });
  } catch (err) {
    console.error('QR code generation error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ======================== HTML ROUTE DISPATCHERS ======================== //

const PUBLIC_DIR = path.resolve(__dirname, 'public');

// Admin Login
app.get('/login', (req, res) => {
  res.sendFile('admin-login.html', { root: PUBLIC_DIR });
});

// Admin Dashboard
app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: PUBLIC_DIR });
});

// Customer View (by random link: /pay/:token or /c/:token)
app.get(['/pay/:token', '/c/:token'], (req, res) => {
  res.sendFile('customer.html', { root: PUBLIC_DIR });
});

// Root redirect
app.get('/', (req, res) => {
  const authToken = req.cookies['admin_session'];
  if (authToken === 'authorized_admin_session_token') {
    return res.redirect('/admin');
  }
  return res.redirect('/login');
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Customer Portal Server running on http://localhost:${PORT}`);
  console.log(`🔑 Admin Login:     http://localhost:${PORT}/login`);
  console.log(`⚙️ Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`📱 Sample Customer: http://localhost:${PORT}/pay/pay78291`);
  console.log(`====================================================`);
});

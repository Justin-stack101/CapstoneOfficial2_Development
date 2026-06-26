import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';

import User from './models/User.js';
import Job from './models/Job.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve static folder paths (frontend directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, '../frontend');

// Connect to Database
await connectDB();

// Database seeding function
const seedDatabase = async () => {
  try {
    const defaultUsers = [
      { name: 'System Owner', role: 'owner', email: 'owner@hontech.com', password: process.env.OWNER_PASSWORD },
      { name: 'System Admin', role: 'admin', email: 'admin@hontech.com', password: process.env.ADMIN_PASSWORD },
      { name: 'Jessica (Front Desk)', role: 'assistant', email: 'staff@hontech.com', password: process.env.STAFF_PASSWORD },
      { name: 'Mark (Advisor)', role: 'sa', email: 'sa@hontech.com', password: process.env.SA_PASSWORD },
      { name: 'Dave (Advisor)', role: 'sa', email: 'tech@hontech.com', password: process.env.TECH_PASSWORD }
    ];

    for (const u of defaultUsers) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        console.log(`Seeding missing default credential for ${u.name} (${u.email})...`);
        const newUser = new User(u);
        await newUser.save(); // Password is hashed pre-save
      }
    }

    const jobCount = await Job.countDocuments();
    if (jobCount <= 3) {
      console.log('Seeding initial placeholder and historical jobs for analytics...');
      await Job.deleteMany({}); // clear small initial seeds to ensure analytics load
      
      const today = new Date().toISOString().split('T')[0];
      
      // Helper to construct relative dates
      const getRelativeDate = (offsetDays) => {
        const d = new Date();
        d.setDate(d.getDate() - offsetDays);
        return d.toISOString().split('T')[0];
      };

      const defaultJobs = [
        // TODAY (Active & Completed)
        {
          id: 'ONL-1001',
          source: 'Online',
          plate: 'XYZ 123',
          name: 'Alice Smith',
          contact: '0912-345-6789',
          category: 'PMS',
          vehicle: 'Toyota Vios',
          concern: 'Change Oil and Filter',
          dateReceived: today,
          apptDate: today,
          apptTime: '08:00',
          confirmed: true,
          status: 'Pending',
          partsAvailable: 'Yes'
        },
        {
          id: 'WLK-2002',
          source: 'Walk-in',
          plate: 'ABC 987',
          name: 'Bob Jones',
          contact: '0912-000-1111',
          category: 'GR',
          vehicle: 'Honda Civic',
          concern: 'Brakes squeaking, check pads',
          dateReceived: today,
          arrival: '09:00',
          claimStub: `${today.replace(/-/g, '').slice(4)}060626-001`,
          partsAvailable: 'Pending',
          evaluation: 'Checking pads',
          status: 'Lift 1',
          bayAssigned: 0,
          saName: 'Mark (Advisor)'
        },
        {
          id: 'WLK-2003',
          source: 'Walk-in',
          plate: 'LMN 456',
          name: 'Charlie Brown',
          contact: '0912-555-5555',
          category: 'Check-Up',
          vehicle: 'Nissan City',
          concern: 'Scratch on front bumper',
          dateReceived: today,
          claimStub: `${today.replace(/-/g, '').slice(4)}060626-002`,
          partsAvailable: 'Pending',
          evaluation: 'Awaiting Paint',
          status: 'Carry Over',
          promisedDate: today,
          remarks: 'Paint curing delay',
          saName: 'Mark (Advisor)'
        },
        {
          id: 'WLK-2004',
          source: 'Walk-in',
          plate: 'AAA 1111',
          name: 'Dave Smith',
          category: 'PMS',
          vehicle: 'Toyota Fortuner',
          concern: '40k KM PMS checkup',
          dateReceived: today,
          arrival: '08:30',
          departure: '10:30',
          claimStub: `${today.replace(/-/g, '').slice(4)}060626-003`,
          status: 'Completed',
          dateCompleted: today,
          saName: 'Mark (Advisor)'
        },
        {
          id: 'ONL-1005',
          source: 'Online',
          plate: 'BBB 2222',
          name: 'Elena Rostova',
          category: 'GR',
          vehicle: 'Hyundai Accent',
          concern: 'Alternator replacement',
          dateReceived: today,
          arrival: '10:00',
          departure: '12:15',
          claimStub: `${today.replace(/-/g, '').slice(4)}060626-004`,
          status: 'Completed',
          dateCompleted: today,
          saName: 'Mark (Advisor)'
        },

        // YESTERDAY (Completed)
        {
          id: 'WLK-2006',
          source: 'Walk-in',
          plate: 'CCC 3333',
          name: 'Francis Ge',
          category: 'PMS',
          vehicle: 'Mitsubishi Mirage',
          dateReceived: getRelativeDate(1),
          arrival: '09:00',
          departure: '10:30',
          claimStub: 'YEST-001',
          status: 'Completed',
          dateCompleted: getRelativeDate(1)
        },
        {
          id: 'ONL-1007',
          source: 'Online',
          plate: 'DDD 4444',
          name: 'Gail Garcia',
          category: 'Check-Up',
          vehicle: 'Ford Ranger',
          dateReceived: getRelativeDate(1),
          arrival: '13:00',
          departure: '13:45',
          claimStub: 'YEST-002',
          status: 'Completed',
          dateCompleted: getRelativeDate(1)
        },

        // PAST WEEK (Completed)
        {
          id: 'WLK-2008',
          source: 'Walk-in',
          plate: 'EEE 5555',
          name: 'Harry Styles',
          category: 'PMS',
          vehicle: 'Toyota Vios',
          dateReceived: getRelativeDate(2),
          arrival: '08:15',
          departure: '09:45',
          status: 'Completed',
          dateCompleted: getRelativeDate(2)
        },
        {
          id: 'ONL-1009',
          source: 'Online',
          plate: 'FFF 6666',
          name: 'Ian Cruz',
          category: 'GR',
          vehicle: 'Honda City',
          dateReceived: getRelativeDate(2),
          arrival: '11:00',
          departure: '14:30',
          status: 'Completed',
          dateCompleted: getRelativeDate(2)
        },
        {
          id: 'WLK-2010',
          source: 'Walk-in',
          plate: 'GGG 7777',
          name: 'Julia Roberts',
          category: 'PMS',
          vehicle: 'Subaru Forester',
          dateReceived: getRelativeDate(3),
          arrival: '10:00',
          departure: '12:00',
          status: 'Completed',
          dateCompleted: getRelativeDate(3)
        },
        {
          id: 'WLK-2011',
          source: 'Walk-in',
          plate: 'HHH 8888',
          name: 'Kevin Bacon',
          category: 'Check-Up',
          vehicle: 'Mazda 3',
          dateReceived: getRelativeDate(4),
          arrival: '14:00',
          departure: '14:40',
          status: 'Completed',
          dateCompleted: getRelativeDate(4)
        },
        {
          id: 'ONL-1012',
          source: 'Online',
          plate: 'III 9999',
          name: 'Liam Neeson',
          category: 'GR',
          vehicle: 'Toyota Hilux',
          dateReceived: getRelativeDate(5),
          arrival: '08:00',
          departure: '11:30',
          status: 'Completed',
          dateCompleted: getRelativeDate(5)
        },
        {
          id: 'WLK-2013',
          source: 'Walk-in',
          plate: 'JJJ 1212',
          name: 'Manny Pacquiao',
          category: 'PMS',
          vehicle: 'Toyota Alphard',
          dateReceived: getRelativeDate(6),
          arrival: '09:30',
          departure: '11:15',
          status: 'Completed',
          dateCompleted: getRelativeDate(6)
        },

        // PAST MONTH (Completed)
        {
          id: 'WLK-2014',
          source: 'Walk-in',
          plate: 'KKK 2323',
          name: 'Normani Kordei',
          category: 'PMS',
          vehicle: 'Suzuki Swift',
          dateReceived: getRelativeDate(12),
          arrival: '10:00',
          departure: '11:30',
          status: 'Completed',
          dateCompleted: getRelativeDate(12)
        },
        {
          id: 'ONL-1015',
          source: 'Online',
          plate: 'LLL 3434',
          name: 'Orlando Bloom',
          category: 'GR',
          vehicle: 'Audi A4',
          dateReceived: getRelativeDate(15),
          arrival: '13:00',
          departure: '16:00',
          status: 'Completed',
          dateCompleted: getRelativeDate(15)
        },
        {
          id: 'WLK-2016',
          source: 'Walk-in',
          plate: 'MMM 4545',
          name: 'Penelope Cruz',
          category: 'Check-Up',
          vehicle: 'Kia Picanto',
          dateReceived: getRelativeDate(20),
          arrival: '09:00',
          departure: '09:45',
          status: 'Completed',
          dateCompleted: getRelativeDate(20)
        },
        {
          id: 'ONL-1017',
          source: 'Online',
          plate: 'NNN 5656',
          name: 'Quentin Tarantino',
          category: 'PMS',
          vehicle: 'Toyota Prius',
          dateReceived: getRelativeDate(25),
          arrival: '08:30',
          departure: '10:00',
          status: 'Completed',
          dateCompleted: getRelativeDate(25)
        }
      ];

      const seededJobs = defaultJobs.map((job, index) => ({
        ...job,
        branch: index % 2 === 0 ? 'Branch A' : 'Branch B',
        location: (job.status && job.status.startsWith('Lift')) ? job.status : 'None'
      }));

      await Job.insertMany(seededJobs);
      console.log('Placeholder and historical seed jobs successfully saved!');
    }
  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
};

// Seed db asynchronously in background
seedDatabase();

// Security Middleware (Disable helmet CSP to ensure Lucide Icons, Google Fonts, and Tailwind CDN load properly)
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS Configuration
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Rate Limiter for Authentication endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' }
});
app.use('/api/auth/login', loginLimiter);

// API Routing
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);

// Serve Static Frontend Assets with no-cache headers to prevent browser caching issues during development
app.use(express.static(frontendPath, {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Fallback to serve index.html for undefined requests (Single Page App helper)
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Heartbeat / Presence state cleanup: check for inactive supervisors every minute
setInterval(async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await User.updateMany(
      { isOnline: true, lastActive: { $lt: fiveMinutesAgo } },
      { isOnline: false }
    );
  } catch (error) {
    console.error('Error cleaning up offline users:', error.message);
  }
}, 60000);

// Start listening
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  source: {
    type: String,
    enum: ['Walk-in', 'Online'],
    required: true
  },
  plate: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contact: {
    type: String,
    trim: true
  },
  vehicle: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  concern: {
    type: String,
    trim: true
  },
  laneType: {
    type: String,
    enum: ['Flexible (Ordinary)', 'Express Lane', 'Special Lane', ''],
    default: ''
  },
  dateReceived: {
    type: String, // Stored as YYYY-MM-DD for standard front-end formatting compatibility
    required: true
  },
  arrival: {
    type: String, // HH:MM format
    default: ''
  },
  departure: {
    type: String, // HH:MM format
    default: ''
  },
  apptDate: {
    type: String, // YYYY-MM-DD format
    default: ''
  },
  apptTime: {
    type: String, // HH:MM format
    default: ''
  },
  confirmed: {
    type: Boolean,
    default: false
  },
  claimStub: {
    type: String,
    default: ''
  },
  partsAvailable: {
    type: String,
    enum: ['Pending', 'Yes', 'No', 'WCA'],
    default: 'Pending'
  },
  evaluation: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    required: true,
    default: 'Pending'
  },
  location: {
    type: String,
    enum: ['None', 'Lift 1', 'Lift 2', 'Lift 3', 'Lift 4'],
    default: 'None'
  },
  branch: {
    type: String,
    enum: ['Branch A', 'Branch B'],
    default: 'Branch A'
  },
  bayAssigned: {
    type: Number,
    default: null
  },
  promisedDate: {
    type: String, // YYYY-MM-DD format
    default: ''
  },
  remarks: {
    type: String,
    default: ''
  },
  saName: {
    type: String,
    default: ''
  },
  goalStatus: {
    type: String,
    enum: ['Successful', 'Failed', 'N/A'],
    default: 'N/A'
  },
  recommendation: {
    type: String,
    enum: ['None', 'Pending Approval', 'Approved', 'Declined'],
    default: 'None'
  },
  recommendationNotes: {
    type: String,
    default: ''
  },
  dateCompleted: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const Job = mongoose.model('Job', jobSchema);
export default Job;

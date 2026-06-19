import Job from '../models/Job.js';

const tempFiles = {};

// Clean up expired temp files older than 2 minutes every minute
setInterval(() => {
  const now = Date.now();
  for (const key in tempFiles) {
    if (now - tempFiles[key].timestamp > 2 * 60 * 1000) {
      delete tempFiles[key];
    }
  }
}, 60000);

// Helper to generate a claim stub number unique to the current date
const generateStubNumber = async () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const datePrefix = `${mm}${dd}${yy}`;
  
  const pattern = new RegExp(`^${datePrefix}-`);
  const count = await Job.countDocuments({ claimStub: pattern });
  return `${datePrefix}-${(count + 1).toString().padStart(3, '0')}`;
};

export const getJobs = async (req, res) => {
  try {
    let query = { status: { $ne: 'Completed' } };
    if (req.user && req.user.role === 'sa' && req.query.monitor !== 'true') {
      query.$or = [
        { saName: req.user.name },
        { saName: '' },
        { saName: null }
      ];
    }
    const jobs = await Job.find(query).sort({ updatedAt: -1 });
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving jobs.', error: error.message });
  }
};

export const createJob = async (req, res) => {
  const { source, plate, name, contact, vehicle, category, concern, dateReceived, arrival, apptDate, apptTime, confirmed } = req.body;

  try {
    if (!plate || !name || !vehicle || !category) {
      return res.status(400).json({ message: 'Plate, Name, Vehicle, and Category are required.' });
    }

    const isWalkin = source === 'Walk-in';
    const prefix = isWalkin ? 'WLK-' : 'ONL-';
    const jobId = prefix + Math.floor(1000 + Math.random() * 9000);

    let finalArrival = arrival || '';
    let claimStub = '';
    let initialStatus = 'Pending';

    if (isWalkin) {
      // Default to current HH:MM local time if not provided
      const now = new Date();
      finalArrival = arrival || now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      claimStub = await generateStubNumber();
      initialStatus = 'Waiting';
    } else {
      initialStatus = 'Pending';
    }

    const newJob = new Job({
      id: jobId,
      source,
      plate: plate.toUpperCase(),
      name,
      contact,
      vehicle,
      category,
      concern,
      dateReceived: dateReceived || new Date().toISOString().split('T')[0],
      arrival: finalArrival,
      apptDate: apptDate || '',
      apptTime: apptTime || '',
      confirmed: confirmed || false,
      claimStub,
      status: initialStatus,
      saName: isWalkin && req.user ? req.user.name : ''
    });

    await newJob.save();
    res.status(201).json(newJob);
  } catch (error) {
    res.status(500).json({ message: 'Error registering job.', error: error.message });
  }
};

export const updateJobField = async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body;

  try {
    const job = await Job.findOne({ id });
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    // Assigning the dynamic property
    job[field] = value;

    // Auto-calculate goalStatus if relevant fields change
    if (field === 'arrival' || field === 'departure' || field === 'category') {
      const isPMS = job.category && job.category.toUpperCase().includes('PMS');
      if (isPMS && job.arrival && job.departure) {
        try {
          const [arrH, arrM] = job.arrival.split(':').map(Number);
          const [depH, depM] = job.departure.split(':').map(Number);
          if (!isNaN(arrH) && !isNaN(arrM) && !isNaN(depH) && !isNaN(depM)) {
            const arrMin = arrH * 60 + arrM;
            const depMin = depH * 60 + depM;
            let diff = depMin - arrMin;
            if (diff < 0) diff += 24 * 60;
            job.goalStatus = diff <= 120 ? 'Successful' : 'Failed';
          }
        } catch (e) {
          // ignore
        }
      }
    }

    await job.save();
    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ message: 'Error updating field.', error: error.message });
  }
};

export const setJobStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const job = await Job.findOne({ id });
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    let previousBay = job.bayAssigned;
    let newBay = null;

    if (status.startsWith('Lift')) {
      const liftNum = parseInt(status.split(' ')[1]) - 1; // 0-indexed lift

      // Collision Check: Check if lift is occupied by any other active job
      const liftOccupied = await Job.findOne({
        id: { $ne: id },
        bayAssigned: liftNum,
        status: { $regex: /^Lift|^In Service/ }
      });

      if (liftOccupied) {
        return res.status(400).json({ message: `Lift 0${liftNum + 1} is already occupied by vehicle ${liftOccupied.plate}!` });
      }

      newBay = liftNum;
    }

    job.status = status;
    job.bayAssigned = newBay;

    // If online booking becomes Waiting/Active and has no claim stub yet, generate one
    if (status === 'Waiting' && job.source === 'Online' && !job.claimStub) {
      job.claimStub = await generateStubNumber();
    }

    // Set departure timestamp upon release if not present
    if (status === 'Released' && !job.departure) {
      const now = new Date();
      job.departure = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    }

    if (status === 'Completed') {
      job.status = 'Completed';
      const today = new Date().toISOString().split('T')[0];
      job.dateCompleted = today;
      if (!job.departure) {
        const now = new Date();
        job.departure = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      }
    }

    // Auto-calculate goalStatus if it is N/A and category is PMS
    const isPMS = job.category && job.category.toUpperCase().includes('PMS');
    if (isPMS && job.arrival && job.departure && (job.goalStatus === 'N/A' || !job.goalStatus)) {
      try {
        const [arrH, arrM] = job.arrival.split(':').map(Number);
        const [depH, depM] = job.departure.split(':').map(Number);
        if (!isNaN(arrH) && !isNaN(arrM) && !isNaN(depH) && !isNaN(depM)) {
          const arrMin = arrH * 60 + arrM;
          const depMin = depH * 60 + depM;
          let diff = depMin - arrMin;
          if (diff < 0) diff += 24 * 60;
          job.goalStatus = diff <= 120 ? 'Successful' : 'Failed';
        }
      } catch (e) {
        // ignore
      }
    }

    await job.save();
    return res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ message: 'Error updating job status.', error: error.message });
  }
};

export const deleteJob = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedJob = await Job.findOneAndDelete({ id });
    if (!deletedJob) {
      return res.status(404).json({ message: 'Job record not found.' });
    }
    res.status(200).json({ message: 'Job successfully removed from system.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting job record.', error: error.message });
  }
};

export const uploadTempFile = (req, res) => {
  const { fileData, fileName, contentType } = req.body;

  try {
    if (!fileData || !fileName || !contentType) {
      return res.status(400).json({ message: 'Missing parameters.' });
    }

    const fileId = 'temp_' + Math.random().toString(36).substring(2, 15);
    tempFiles[fileId] = {
      fileData,
      fileName,
      contentType,
      timestamp: Date.now()
    };

    res.status(200).json({ fileId });
  } catch (error) {
    res.status(500).json({ message: 'Error staging temporary file.', error: error.message });
  }
};

export const downloadTempFile = (req, res) => {
  const { fileId } = req.params;

  try {
    const file = tempFiles[fileId];
    if (!file) {
      return res.status(404).send('File not found or link has expired.');
    }

    const buffer = Buffer.from(file.fileData, 'base64');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(buffer);

    // Remove file immediately after sending to free up memory
    delete tempFiles[fileId];
  } catch (error) {
    res.status(500).send('Error serving file download.');
  }
};

export const getAnalyticsData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};

    if (startDate || endDate) {
      query.dateReceived = {};
      if (startDate) query.dateReceived.$gte = startDate;
      if (endDate) query.dateReceived.$lte = endDate;
    }

    // Return both active and completed jobs for comprehensive reports
    const jobs = await Job.find(query).sort({ dateReceived: -1 });
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving analytics data.', error: error.message });
  }
};

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Job from './models/Job.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for Seeding stress test data...');
  } catch (error) {
    console.error(`Connection error: ${error.message}`);
    process.exit(1);
  }
};

const seedStressData = async () => {
  await connectDB();
  
  try {
    // Clear all existing jobs to prevent unique ID constraint conflicts
    await Job.deleteMany({});
    console.log('Cleared all jobs.');

    const today = new Date().toISOString().split('T')[0];

    const stressJobs = [
      // --- SLIDE 1: ACTIVE LIFT CARS (4 Lifts) ---
      {
        id: 'WLK-ST01',
        source: 'Walk-in',
        plate: 'LIF-0001',
        name: 'John Doe',
        contact: '0917-111-2222',
        category: 'PMS',
        vehicle: 'Toyota Hilux',
        concern: '10k km maintenance',
        dateReceived: today,
        arrival: '08:00',
        status: 'Lift 1',
        bayAssigned: 1,
        saName: 'Mark (Advisor)'
      },
      {
        id: 'WLK-ST02',
        source: 'Walk-in',
        plate: 'LIF-0002',
        name: 'Jane Miller',
        contact: '0917-333-4444',
        category: 'GRS',
        vehicle: 'Honda Civic Type R',
        concern: 'Clutch slip check',
        dateReceived: today,
        arrival: '08:30',
        status: 'Lift 2',
        bayAssigned: 2,
        saName: 'Dave (Advisor)'
      },
      {
        id: 'WLK-ST03',
        source: 'Walk-in',
        plate: 'LIF-0003',
        name: 'Robert King',
        contact: '0917-555-6666',
        category: 'PMS AND GRS',
        vehicle: 'Mitsubishi Montero',
        concern: 'Engine light and brake replacement',
        dateReceived: today,
        arrival: '09:00',
        status: 'Lift 3',
        bayAssigned: 3,
        saName: 'Mark (Advisor)'
      },
      {
        id: 'WLK-ST04',
        source: 'Walk-in',
        plate: 'LIF-0004',
        name: 'Patricia Lee',
        contact: '0917-777-8888',
        category: 'AC Repair',
        vehicle: 'Hyundai Staria',
        concern: 'Aircon not cooling',
        dateReceived: today,
        arrival: '09:15',
        status: 'Lift 4',
        bayAssigned: 4,
        saName: 'Dave (Advisor)'
      },

      // --- SLIDE 2: UPCOMING VEHICLES QUEUE (8 Cars) ---
      {
        id: 'ONL-Q01',
        source: 'Online',
        plate: 'QUE-1111',
        name: 'Sarah Connor',
        category: 'PMS',
        vehicle: 'Ford Ranger Raptor',
        dateReceived: today,
        status: 'Waiting'
      },
      {
        id: 'WLK-Q02',
        source: 'Walk-in',
        plate: 'QUE-2222',
        name: 'Tony Stark',
        category: 'GRS',
        vehicle: 'Audi R8 e-tron',
        dateReceived: today,
        status: 'Waiting'
      },
      {
        id: 'ONL-Q03',
        source: 'Online',
        plate: 'QUE-3333',
        name: 'Bruce Wayne',
        category: 'PMS AND GRS',
        vehicle: 'Mercedes S-Class',
        dateReceived: today,
        status: 'Waiting'
      },
      {
        id: 'WLK-Q04',
        source: 'Walk-in',
        plate: 'QUE-4444',
        name: 'Peter Parker',
        category: 'Carwash & Wax',
        vehicle: 'Honda Fit',
        dateReceived: today,
        status: 'Waiting'
      },
      {
        id: 'ONL-Q05',
        source: 'Online',
        plate: 'QUE-5555',
        name: 'Clark Kent',
        category: 'PMS',
        vehicle: 'Toyota Corolla Cross',
        dateReceived: today,
        status: 'Waiting'
      },
      {
        id: 'WLK-Q06',
        source: 'Walk-in',
        plate: 'QUE-6666',
        name: 'Bruce Banner',
        category: 'Suspension Check',
        vehicle: 'Ford F-150',
        dateReceived: today,
        status: 'Waiting'
      },
      {
        id: 'ONL-Q07',
        source: 'Online',
        plate: 'QUE-7777',
        name: 'Diana Prince',
        category: 'GRS',
        vehicle: 'Jeep Wrangler',
        dateReceived: today,
        status: 'Waiting'
      },
      {
        id: 'WLK-Q08',
        source: 'Walk-in',
        plate: 'QUE-8888',
        name: 'Barry Allen',
        category: 'Wheel Alignment',
        vehicle: 'Mazda MX-5',
        dateReceived: today,
        status: 'Waiting'
      },

      // --- SLIDE 2: READY FOR RELEASE (6 Cars) ---
      {
        id: 'WLK-R01',
        source: 'Walk-in',
        plate: 'REL-1111',
        name: 'Steve Rogers',
        category: 'PMS',
        vehicle: 'Harley Davidson',
        dateReceived: today,
        status: 'Ready'
      },
      {
        id: 'ONL-R02',
        source: 'Online',
        plate: 'REL-2222',
        name: 'Natasha Romanoff',
        category: 'GRS',
        vehicle: 'Chevrolet Corvette',
        dateReceived: today,
        status: 'Released'
      },
      {
        id: 'WLK-R03',
        source: 'Walk-in',
        plate: 'REL-3333',
        name: 'Clint Barton',
        category: 'PMS AND GRS',
        vehicle: 'Dodge Ram 1500',
        dateReceived: today,
        status: 'Ready'
      },
      {
        id: 'ONL-R04',
        source: 'Online',
        plate: 'REL-4444',
        name: 'Wanda Maximoff',
        category: 'Brake Service',
        vehicle: 'Audi A4',
        dateReceived: today,
        status: 'Ready'
      },
      {
        id: 'WLK-R05',
        source: 'Walk-in',
        plate: 'REL-5555',
        name: 'Vision Synthezoid',
        category: 'PMS',
        vehicle: 'Tesla Model S',
        dateReceived: today,
        status: 'Released'
      },
      {
        id: 'ONL-R06',
        source: 'Online',
        plate: 'REL-6666',
        name: 'Sam Wilson',
        category: 'Detailing',
        vehicle: 'Dodge Challenger',
        dateReceived: today,
        status: 'Ready'
      },

      // --- SLIDE 2: CARRY OVER (4 Cars) ---
      {
        id: 'WLK-C01',
        source: 'Walk-in',
        plate: 'CAR-1111',
        name: 'Arthur Dent',
        category: 'GRS',
        vehicle: 'Ford Prefect',
        dateReceived: today,
        status: 'Carry Over'
      },
      {
        id: 'ONL-C02',
        source: 'Online',
        plate: 'CAR-2222',
        name: 'Ford Prefect',
        category: 'Engine Overhaul',
        vehicle: 'Volvo 240',
        dateReceived: today,
        status: 'Carry Over'
      },
      {
        id: 'WLK-C03',
        source: 'Walk-in',
        plate: 'CAR-3333',
        name: 'Tricia McMillan',
        category: 'PMS AND GRS',
        vehicle: 'Tesla Model 3',
        dateReceived: today,
        status: 'Carry Over'
      },
      {
        id: 'ONL-C04',
        source: 'Online',
        plate: 'CAR-4444',
        name: 'Zaphod Beeblebrox',
        category: 'Transmission Repair',
        vehicle: 'Porsche 911',
        dateReceived: today,
        status: 'Carry Over'
      }
    ];

    await Job.insertMany(stressJobs);
    console.log('Seeded 22 stress test jobs successfully!');
  } catch (error) {
    console.error('Error seeding data:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
  }
};

seedStressData();

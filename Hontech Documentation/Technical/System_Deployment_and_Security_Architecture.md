# System Deployment and Security Architecture

This document outlines the deployment strategy and security safeguards for the Hontech AutoCenter Queue and Operations Management System, focusing on safeguarding customer data, finance data, and parts inventory.

## 1. On-Premises Local Area Network (LAN) Deployment (Current Stage)

For the initial launch and Capstone presentation, the system is deployed purely as an **On-Premises Intranet System**.

```
[ Advisor PC ] <----\ (Private Local Wi-Fi / Ethernet)
                     \
[ Assistant PC ] <----> [ On-Site Host Server PC ]
                     /
[ TV Monitor ] <----/
```

### Key Security Advantages:
* **No Public Internet Exposure:** The server port (`5000` for API / `27017` for MongoDB) is only exposed to the local router. Attackers on the public internet cannot see, scan, or attempt connection handshakes.
* **Offline Reliability:** Since all database traffic is routed through the local router, the queue dashboard and TV monitor will continue to function seamlessly even if the building loses internet connection.
* **Zero Monthly Hosting Fees:** Leveraging existing shop hardware avoids cloud subscription expenses.

### Local Deployment Steps:
1. Identify a designated Host PC onsite to run the server.
2. In the terminal of the Host PC, run the server:
   ```bash
   npm start
   ```
3. Open command prompt and run `ipconfig` to find the IPv4 Address (e.g. `192.168.1.105`).
4. On other onsite devices connected to the same Wi-Fi, open the browser and navigate to:
   ```
   http://192.168.1.105:5000
   ```

---

## 2. Multi-Branch Scaling & Future Cloud Security

When Hontech expands to multiple physical branches (e.g. Branch A, Branch B) or needs remote administrative access, the system can scale using one of these secure designs:

### Option A: Cloud Hosting with Static IP Whitelisting (Recommended)
* **Design:** Host the Node/Express server and MongoDB in a secure cloud VPC (e.g., AWS, Render, MongoDB Atlas).
* **Security Control:** Configure the cloud firewall rules to **only allow traffic originating from the static IP addresses of the physical shops**.
* **Result:** Restricts access purely to physical employees onsite, blocking all general public internet users.

### Option B: Site-to-Site VPN
* **Design:** The server remains on a physical machine in Branch A. 
* **Security Control:** Secure IPsec or SD-WAN tunnels are established between the routers of Branch A, Branch B, and Branch C.
* **Result:** Inter-branch traffic travels over an encrypted private tunnel, keeping the application completely hidden from the public internet.

---

## 3. Data Protection Controls

* **Schema Sanitization:** The backend uses **Mongoose Schema definitions** to sanitize inputs, rendering NoSQL injection attacks ineffective.
* **Password Hashing:** All employee credentials are encrypted using **bcrypt** before database insertion.
* **Role-Based Access Control (RBAC):** Access to finance reports, user management, and exports are locked at the API level to specific roles (`owner` / `admin`).
* **Mock Data Integrity:** In development/testing, only fictional customer profiles (`0917-555-6666`) are used to completely eliminate any data leak liability.

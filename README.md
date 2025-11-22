Here is a clean, professional **README.md** you can directly copy-paste into your project.

---

# **Tick-M Events — Backend Server**

**Domain:** [https://tick-m.cloud](https://tick-m.cloud)
**Main Server:** Port **8000**
**Socket Server:** Port **8001**

Tick-M Events Backend is a Node.js + Express server that powers the Tick-M Events platform.
It includes APIs for authentication, events management, ticketing, media handling, real-time socket communication, and more.

---

## 🚀 **Tech Stack**

* **Node.js (v20.x recommended)**
* **Express.js**
* **MongoDB + Mongoose**
* **Socket.IO**
* **Cloudinary**
* **Firebase Admin**
* **JWT Authentication**
* **Nodemailer**
* **Cron Jobs**
* **Sharp / Multer / File Uploads**

---

## 📁 **Project Structure**

```
backend/
│── controllers/
│── models/
│── routes/
│── middlewares/
│── utils/
│── uploads/
│── index.js
│── package.json
│── .env
```

---

## ⚙️ **Environment Variables**

Create a `.env` file in the root directory and configure:

```
PORT=8000
SOCKET_PORT=8001

MONGO_URI=your_mongo_connection_string
JWT_SECRET=your_secret_key

CLOUDINARY_CLOUD_NAME=xxxx
CLOUDINARY_API_KEY=xxxx
CLOUDINARY_API_SECRET=xxxx

FIREBASE_PRIVATE_KEY=xxxx
FIREBASE_CLIENT_EMAIL=xxxx
FIREBASE_PROJECT_ID=xxxx

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_EMAIL=your_email
SMTP_PASSWORD=your_password
```

---

## 🛠️ **Installation**

Clone the repository:

```bash
git clone https://github.com/nitinsahu-sahu/tick-m-events.git
cd tick-m-events
```

Install dependencies:

```bash
npm install
# or
yarn install
```

---

## ▶️ **Running the Server**

### **Development Mode**

```bash
npm run dev
# or
yarn dev
```

### **Production Mode**

```bash
npm run production
```

---

## 🌐 **Access the Server**

| Service             | URL                                            |
| ------------------- | ---------------------------------------------- |
| **Main API Server** | [http://localhost:8000](http://localhost:8000) |
| **Socket Server**   | [http://localhost:8001](http://localhost:8001) |
| **Live Production** | [https://tick-m.cloud](https://tick-m.cloud)   |

---

## 🔌 **Socket Server (Port 8001)**

The socket server runs separately for:

* Live event updates
* Real-time notifications
* Ticket scanning status
* Admin dashboard updates

Socket initialization example:

```javascript
const io = require("socket.io")(8001, {
  cors: {
    origin: "*",
  }
});
```

---

## 🧪 **Testing the Application**

Use any API testing tool:

* **Postman**
* **Thunder Client**
* **Insomnia**

Base URL for local testing:

```
http://localhost:8000/
```

Authentication-protected routes require sending the `Authorization: Bearer <token>` header.

---

## 📜 **Scripts**

```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js",
  "production": "NODE_ENV=production node index.js"
}
```

---

## 📄 **License**

This project is licensed under the ISC License.

---

## 📞 **Contact**

For support or queries:

**Email:** [support@tick-m.cloud](mailto:support@tick-m.cloud)
**Website:** [https://tick-m.cloud](https://tick-m.cloud)


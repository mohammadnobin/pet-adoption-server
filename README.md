# 🐾 Pet Adoption Platform - Backend (Server Side)

This is the backend of the **Pet Adoption Platform**, a Node.js + Express API that powers the pet adoption, donation, and authentication logic of the platform.

---

## 🚀 Project Purpose

This backend is responsible for securely managing:

- ✅ Pet-related data (add/update/delete)
- ✅ Adoption requests
- ✅ Donation campaigns and payments
- ✅ Donor tracking and refund logic
- ✅ User roles and authentication via Firebase Admin SDK
- ✅ Stripe payment integration

---

## 📦 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **Auth:** Firebase Admin SDK
- **Payment:** Stripe
- **Environment Config:** dotenv

---

## 🔑 Features (Added by Developer)

- 🔒 JWT-like token verification using Firebase Access Tokens
- 🐶 Pet API (CRUD): add, update, delete, mark as adopted
- 📬 Adoption Requests API (submit, view, accept, reject)
- 💰 Donation Campaigns API (create, view, update, pause)
- 👨‍👩‍👧‍👦 Donors API (add donor, fetch donor list, refund option)
- 💳 Stripe Payment Integration (create payment intents)
- 👥 Role-based access control (admin/user)
- 📆 Timestamps stored in ISO format
- ⚠️ Error-handling with proper status codes
- 🛡️ CORS, environment variables, and route-level protections

---

## 🧪 Running Locally

### 🔧 Prerequisites

- Node.js installed
- MongoDB URI
- Firebase Service Account key
- Stripe Secret Key

### 📁 Folder Structure


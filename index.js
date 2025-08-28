
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);
const app = express();
const port = process.env.PORT || 3000;
// all middlewere here
app.use(cors());
app.use(express.json());
const decodedKey = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// mongo db all code start here

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const db = client.db("pet_adoption");
  const usersCollection = db.collection("users");
  const petsCollection = db.collection("pets");
  const adoptionsCollection = db.collection("adoptions");
  const donationsCollection = db.collection("donations");
  const donorsCollection = db.collection("donor");
  try {
    // cunstom middlewares
    // verifyFb token
    const verifyFbToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthoriazed access" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      // verify the token
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
      } catch (error) {
        return res.status(403).send({ message: "forbidden access" });
      }
    };
    // this is token email verify
    const verifyTokenEmail = (req, res, next) => {
      if (req.query.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // this is token email verify

    // admin verify
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // cunstom middlewares

    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::Admin all API create here start::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // All user gets for Admin
    app.get("/users/search", verifyFbToken, verifyAdmin, async (req, res) => {
      const { searchparams } = req.query;
      let query = {};
      if (searchparams) {
        query = { email: { $regex: searchparams, $options: "i" } };
      }
      try {
        const users = await usersCollection
          .find(query)
          .sort({ created_at: -1 })
          .toArray();

        res.send(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Error fetching users" });
      }
    });
    // user make admin and remove admin
    app.patch(
      "/users/:id/role",
      verifyFbToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const { role } = req.body;

        if (!["admin", "user"].includes(role)) {
          return res.status(400).send({ message: "Invalid role" });
        }

        try {
          const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { role } }
          );
          res.send({ message: `User role updated to ${role}`, result });
        } catch (error) {
          console.error("Error updating user role", error);
          res.status(500).send({ message: "Failed to update user role" });
        }
      }
    );
    // all pets for admin
    app.get("/allpets", verifyFbToken, verifyAdmin, async (req, res) => {
      try {
        const { page = 1, limit = 4, search = "", category = "" } = req.query;
        const query = {};
        if (search) query.petName = { $regex: search, $options: "i" };
        if (category) query.petCategory = category;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const pets = await petsCollection
          .find(query)
          .sort({ addedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send(pets);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });
    // admin pets update put api
    app.put("/admin-pets/:id", verifyFbToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      const result = await petsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updateData,
        }
      );

      res.send(result);
    });

    //::::::::::::::::::: pet delete for admin
    app.delete(
      "/pet-delete-admin/:id",
      verifyFbToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        try {
          const result = await petsCollection.deleteOne({
            _id: new ObjectId(id),
          });
          if (result.deletedCount > 0) {
            res.send({ message: "Pet deleted successfully" });
          } else {
            res.status(404).send({ message: "Pet not found" });
          }
        } catch (error) {
          console.error("Delete Error:", error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      }
    );

    // all donetions get for admin
    app.get("/allDonations", verifyFbToken, verifyAdmin, async (req, res) => {
      try {
        const donations = await donationsCollection
          .find()
          .sort({ addedAt: -1 })
          .toArray();
        res.send(donations);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // dontaions delete for admin
    app.delete(
      "/donations-delete/:id",
      verifyFbToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        try {
          const result = await donationsCollection.deleteOne({
            _id: new ObjectId(id),
          });
          if (result.deletedCount > 0) {
            res.send({ message: "Pet deleted successfully" });
          } else {
            res.status(404).send({ message: "Pet not found" });
          }
        } catch (error) {
          console.error("Delete Error:", error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      }
    );
    // donatiosn stataus update for admin
    app.patch(
      "/donations/toggle-status/:id",
      verifyFbToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;

        try {
          // 🔍 Find the donation
          const donation = await donationsCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!donation) {
            return res.status(404).send({ message: "Donation not found" });
          }

          // 🔁 Toggle 'pause' field only
          const newPauseValue = donation.pause === "pause" ? "resume" : "pause";

          const result = await donationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { pause: newPauseValue } }
          );

          res.send({
            message: `Donation ${
              newPauseValue === "pause" ? "paused" : "resumed"
            } successfully`,
            pause: newPauseValue,
          });
        } catch (error) {
          console.error("Toggle Pause Error:", error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      }
    );

    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::Admin all API create here end::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::User all API create here start::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

    //::::::::::::::::::: added all user start -----------------------------
    // get: get user by search
    app.get("/users/:email/role", verifyFbToken, async (req, res) => {
      try {
        const email = req.params.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ role: user.role || "user" });
      } catch (error) {
        console.error("Error getting user role:", error);
        res.status(500).send({ message: "Failed to get role" });
      }
    });
    // get all users
    app.get("/all-users", verifyFbToken, verifyAdmin, async (req, res) => {
      const users = req.body;
      const result = await usersCollection.find(users).toArray();
      res.send(result);
    });
    // psot all users
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const userExists = await usersCollection.findOne({ email });

      if (userExists) {
        // Update only the last_log_in field
        const updateResult = await usersCollection.updateOne(
          { email },
          { $set: { last_log_in: new Date().toISOString() } }
        );

        return res.status(200).send({
          message: "User already exists. last_log_in updated.",
          inserted: false,
          updated: updateResult.modifiedCount > 0,
        });
      }

      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    //::::::::::::::::::: added all user end -----------------------------
    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::User all API create here end::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::All Pets api making here start::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    //::::::::::::::::::: pet get

    app.get("/api/pets/latest", async (req, res) => {
  try {
    const pets = await petsCollection
      .find({ adopted: "notAdopted" }) // শুধুমাত্র non-adopted pets
      .sort({ addedAt: -1 }) // newest first
      .limit(6)
      .toArray();

    res.json(pets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});


    app.get("/pets", async (req, res) => {
      try {
        const { page = 1, limit = 6, search = "", category = "" } = req.query;
        const query = { adopted: "notAdopted" };

        if (search) query.petName = { $regex: search, $options: "i" };
        if (category) query.petCategory = category;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const pets = await petsCollection
          .find(query)
          .sort({ addedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send(pets);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // signgle pets get
    app.get("/pets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const objectId = new ObjectId(id); // MongoDB ObjectId এ কনভার্ট করো

        const pet = await petsCollection.findOne({ _id: objectId });

        if (!pet) {
          return res.status(404).send({ message: "Pet not found" });
        }

        res.send(pet);
      } catch (error) {
        console.error("Error fetching pet by ID:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    // Pets request for Adoption
    app.get(
      "/petsrequst",
      verifyFbToken,
      verifyTokenEmail,
      async (req, res) => {
        try {
          const email = req.query.email;

          if (!email) {
            return res.status(400).send({ message: "Email is required" });
          }

          const pets = await petsCollection
            .find({ ownerEmail: email, adopted: "request" })
            .sort({ "adoptedHistory.requestedAt": -1 })
            .toArray();

          res.send(pets);
        } catch (error) {
          res.status(500).send({ message: "Server error", error });
        }
      }
    );
    // accepts and pendign pets
    app.patch("/pets/:id/status", verifyFbToken, async (req, res) => {
      try {
        const { id } = req.params;
        const pet = await petsCollection.findOne({ _id: new ObjectId(id) });
        if (pet?.ownerEmail !== req.decoded?.email) {
          return res.status(403).send({ message: "forbidden access" });
        }

        const { adopted } = req.body;

        if (!adopted || !["adopted", "notAdopted"].includes(adopted)) {
          return res.status(400).send({ message: "Invalid adopted status" });
        }

        // Update pet status
        const petUpdateResult = await petsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              adopted: adopted,
              "adoptedHistory.status":
                adopted === "adopted" ? "adopted" : "rejected",
            },
          }
        );

        // Update the latest adoption request status (only if exists)
        const adoptionUpdateResult = await adoptionsCollection.updateOne(
          { petId: id, status: "request" },
          { $set: { status: adopted === "adopted" ? "adopted" : "rejected" } }
        );

        res.send({
          message: "Pet and adoption status updated",
          petModified: petUpdateResult.modifiedCount > 0,
          adoptionModified: adoptionUpdateResult.modifiedCount > 0,
        });
      } catch (error) {
        console.error("Failed to update pet/adoption status:", error);
        res.status(500).send({ message: "Internal Server Error", error });
      }
    });

    //::::::::::::::::::: pet update
    app.put("/user-pets/:id", verifyFbToken, async (req, res) => {
      const { id } = req.params;
      const pet = await petsCollection.findOne({ _id: new ObjectId(id) });
      if (pet?.ownerEmail !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const updateData = req.body;

      const result = await petsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updateData,
        }
      );

      res.send(result);
    });

    // my pets pagese all api here
    // ✅ Get all pets added by the logged-in user
    app.get(
      "/owner-pets",
      verifyFbToken,
      verifyTokenEmail,
      async (req, res) => {
        const { email } = req.query;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        try {
          const pets = await petsCollection
            .find({ ownerEmail: email })
            .toArray();
          res.send(pets);
        } catch (error) {
          res.status(500).send({ message: "Failed to fetch pets" });
        }
      }
    );
    // ✅ Delete a pet by ID
    app.delete("/pet-woner-delete/:id", verifyFbToken, async (req, res) => {
      const { id } = req.params;
      const pet = await petsCollection.findOne({ _id: new ObjectId(id) });
      if (pet?.ownerEmail !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      try {
        const result = await petsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.send({ success: true, message: "Pet deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Pet not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Failed to delete pet" });
      }
    });

    // ✅ Mark pet as adopted
    app.patch("/pte-owner/adopt/:id", verifyFbToken, async (req, res) => {
      const { id } = req.params;
      const pet = await petsCollection.findOne({ _id: new ObjectId(id) });
      if (pet?.ownerEmail !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      try {
        const result = await petsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { adopted: "adopted" } }
        );

        if (result.modifiedCount === 1) {
          res.send({ success: true, message: "Pet marked as adopted" });
        } else {
          res.status(404).send({
            success: false,
            message: "Pet not found or already adopted",
          });
        }
      } catch (error) {
        res.status(500).send({ message: "Failed to mark pet as adopted" });
      }
    });
    // my pets pagese all api here

    //::::::::::::::::::: pet psot
    app.post("/pets", verifyFbToken, async (req, res) => {
      const petData = req.body;
      const result = await petsCollection.insertOne(petData); // MongoDB
      res.send(result);
    });
    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::All Pets api making here end::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::all pets adoptions  making here start::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // post adooptions request and post adontions in data base
    app.post("/adoptions", verifyFbToken, async (req, res) => {
      try {
        const adoption = req.body;

        // Validate required fields
        if (
          !adoption.petId ||
          !adoption.adopterName ||
          !adoption.adopterEmail ||
          !adoption.adopterPhone ||
          !adoption.adopterAddress
        ) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        // Set timestamps and status
        const timestamp = new Date();
        adoption.requestedAt = timestamp;
        adoption.status = "request";

        // 1️⃣ Insert into adoptionsCollection
        const result = await adoptionsCollection.insertOne(adoption);

        // 2️⃣ Create single adoptedHistory object
        const adoptedInfo = {
          adopterName: adoption.adopterName,
          adopterEmail: adoption.adopterEmail,
          adopterPhone: adoption.adopterPhone,
          adopterAddress: adoption.adopterAddress,
          requestedAt: timestamp,
          status: "request",
        };

        // 3️⃣ Update pet status and set adoptedHistory as object
        const petId = adoption.petId;
        const updateResult = await petsCollection.updateOne(
          { _id: new ObjectId(petId) },
          {
            $set: {
              adopted: "request",
              adoptedHistory: adoptedInfo, // ⬅️ Just one object instead of array
            },
          }
        );

        res.send({
          insertedId: result.insertedId,
          petUpdated: updateResult.modifiedCount > 0,
          message: "Adoption request submitted and pet marked as pending",
        });
      } catch (error) {
        console.error("Failed to  adoption request:", error);
        res.status(500).send({ message: "Internal Server Error", error });
      }
    });

    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::All pets adoptions  making here  end::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::All donations api making here start::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // GET all donations with status "notDonate"
    app.get("/donations", async (req, res) => {
      try {
        const { page = 1, limit = 3 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const donations = await donationsCollection
          .find({
            status: { $in: ["notDonate", "ongoing"] },
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send(donations);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error", error });
      }
    });
    // donations compaings ower
    app.get(
      "/donations-user",
      verifyFbToken,
      verifyTokenEmail,
      async (req, res) => {
        try {
          const userEmail = req.query.email;

          if (!userEmail) {
            return res
              .status(400)
              .send({ message: "Email query parameter is required too" });
          }
          const donations = await donationsCollection
            .find({ campaignOwnerEmail: userEmail })
            .toArray();

          res.send(donations);
        } catch (error) {
          console.error(error);
          res.status(500).send({ message: "Failed to fetch donations too", error });
        }
      }
    );

    // signle donation
    app.get("/donation-details/:id", verifyFbToken, async (req, res) => {
      try {
        const { id } = req.params;
        const donation = await donationsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!donation) {
          return res.status(404).send({ message: "Donation not found" });
        }

        res.send(donation);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch donation too", error });
      }
    });

    // recomended donations
    app.get("/donationsrecommended", verifyFbToken, async (req, res) => {
      try {
        const userEmail = req.decoded.email;
        const excludeId = req.query.excludeId;

        // Step 1: First try to get top 3 recommended (not owned, not this campaign)
        const recommended = await donationsCollection
          .find({
            status: { $in: ["notDonate", "ongoing"] },
            campaignOwnerEmail: { $ne: userEmail },
            _id: { $ne: new ObjectId(excludeId) },
          })
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray();

        if (recommended.length === 3) {
          return res.send(recommended);
        }

        // Step 2: If less than 3 found, fill the rest with other valid campaigns (excluding just current one)
        const filler = await donationsCollection
          .find({
            status: { $in: ["notDonate", "ongoing"] },
            _id: { $ne: new ObjectId(excludeId) },
          })
          .sort({ createdAt: -1 })
          .limit(3 - recommended.length)
          .toArray();

        const finalResult = [...recommended, ...filler].slice(0, 3);
        res.send(finalResult);
      } catch (error) {
        console.error(error);
        res.status(500).send({
          message: "Failed to fetch recommended donations",
          error: error.message,
        });
      }
    });

    // donations update
    app.patch("/donation/:id", verifyFbToken, async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      try {
        const result = await donationsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              petName: updatedData.petName,
              petImage: updatedData.petImage,
              maxDonation: updatedData.maxDonation,
              lastDate: updatedData.lastDate,
              shortDescription: updatedData.shortDescription,
              longDescription: updatedData.longDescription,
            },
          }
        );

        if (result.modifiedCount > 0) {
          res.send({
            success: true,
            message: "Donation updated successfully.",
          });
        } else {
          res.status(404).send({
            success: false,
            message: "Donation not found or not modified.",
          });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });
    // donatiosn stataus update for admin
    app.patch(
      "/donations-toggle-status-user/:id",
      verifyFbToken,
      async (req, res) => {
        const { id } = req.params;

        try {
          // 🔍 Find the donation
          const donation = await donationsCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!donation) {
            return res.status(404).send({ message: "Donation not found" });
          }

          // ✅ Ownership check
          if (donation?.campaignOwnerEmail !== req.decoded?.email) {
            return res.status(403).send({ message: "Forbidden access" });
          }

          // 🔁 Toggle 'pause' field only
          const newPauseValue = donation.pause === "pause" ? "resume" : "pause";

          const result = await donationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { pause: newPauseValue } }
          );

          res.send({
            message: `Donation ${
              newPauseValue === "pause" ? "paused" : "resumed"
            } successfully`,
            pause: newPauseValue,
          });
        } catch (error) {
          console.error("Toggle Pause Error:", error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      }
    );

    // donations post
    app.post("/donations", verifyFbToken, async (req, res) => {
      try {
        const donation = req.body;
        donation.createdAt = new Date().toISOString();
        const result = await donationsCollection.insertOne(donation);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to add donation", error });
      }
    });
    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::All donations api making here  end::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::All dononrs api making here  start::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // donars by donations api
    app.post("/donors/by-ids", verifyFbToken, async (req, res) => {
      const { ids } = req.body; // expects array of donor _id strings

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).send({ message: "No donor IDs provided." });
      }

      const userEmail = req.decoded?.email;
      if (!userEmail) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      try {
        // Step 1: Convert to ObjectIds
        const objectIds = ids.map((id) => new ObjectId(id));

        // Step 2: Get the donor records
        const donors = await donorsCollection
          .find({ _id: { $in: objectIds } })
          .toArray();

        // Step 3: Get the unique donationIds from donors
        const donationIds = donors.map((d) => new ObjectId(d.donationId));

        // Step 4: Get all the related donation campaigns
        const campaigns = await donationsCollection
          .find({ _id: { $in: donationIds } })
          .toArray();

        // Step 5: Check if all campaigns belong to the logged-in user
        const unauthorizedCampaign = campaigns.find(
          (c) => c.campaignOwnerEmail?.toLowerCase() !== userEmail.toLowerCase()
        );

        if (unauthorizedCampaign) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        // Step 6: All OK
        res.send(donors);
      } catch (err) {
        console.error("Failed to fetch donors securely:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // donors woner api api here

    app.post("/donors", verifyFbToken, async (req, res) => {
      const donorData = req.body;
      const { donationId, amount, email, transactionId, paymentMethod } =
        donorData;

      try {
        // 1. Check if donor already exists for this donation campaign
        const existingDonor = await donorsCollection.findOne({
          donationId,
          email,
        });

        let donorId;

        if (existingDonor) {
          // Update existing donor
          await donorsCollection.updateOne(
            { _id: existingDonor._id },
            {
              $inc: { amount: amount },
              $push: {
                transactionHistory: {
                  transactionId,
                  paymentMethod,
                  amount,
                  date: new Date(),
                },
              },
            }
          );
          donorId = existingDonor._id;
        } else {
          // Insert new donor
          const newDonor = {
            ...donorData,
            amount,
            transactionHistory: [
              { transactionId, paymentMethod, amount, date: new Date() },
            ],
            createdAt: new Date(),
          };
          const insertRes = await donorsCollection.insertOne(newDonor);
          donorId = insertRes.insertedId;
        }

        // 2. Update Donation Campaign
        const donationDoc = await donationsCollection.findOne({
          _id: new ObjectId(donationId),
        });

        if (!donationDoc) {
          return res
            .status(404)
            .send({ message: "Donation campaign not found" });
        }

        const newTotal = (donationDoc.collectedAmount || 0) + amount;
        const updatedStatus =
          newTotal >= donationDoc.maxDonation ? "donated" : "ongoing";

        const donationUpdate = await donationsCollection.updateOne(
          { _id: new ObjectId(donationId) },
          {
            $addToSet: { donorIds: donorId },
            $inc: { collectedAmount: amount },
            $set: { status: updatedStatus },
          }
        );

        res.send({
          updatedOrInsertedId: donorId,
          donationUpdated: donationUpdate.modifiedCount > 0,
          updatedStatus,
        });
      } catch (error) {
        console.error("Donor Save Error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    //   donations woners api
    app.get(
      "/donors/user",
      verifyFbToken,
      verifyTokenEmail,
      async (req, res) => {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ error: "Email is required" });
        }

        try {
          const donors = await donorsCollection
            .aggregate([
              {
                $match: { email },
              },
              {
                // String to ObjectId conversion
                $addFields: {
                  donationObjectId: { $toObjectId: "$donationId" },
                },
              },
              {
                $lookup: {
                  from: "donations",
                  localField: "donationObjectId",
                  foreignField: "_id",
                  as: "donationInfo",
                },
              },
              {
                $unwind: "$donationInfo",
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  email: 1,
                  amount: 1,
                  transactionId: 1,
                  transactionHistory: 1,
                  donationId: 1,
                  petName: "$donationInfo.petName",
                  petImage: "$donationInfo.petImage",
                },
              },
            ])
            .toArray();

          res.send(donors);
        } catch (error) {
          console.error("Error fetching user's donations:", error);
          res.status(500).send({ error: "Failed to fetch donations" });
        }
      }
    );
    // donors money refiend

    app.delete("/donors/:id", verifyFbToken, async (req, res) => {
      const { id } = req.params;
      const doner = await donorsCollection.findOne({ _id: new ObjectId(id) });
      if (doner?.email !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      try {
        const donor = await donorsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!donor) return res.status(404).send({ error: "Donor not found" });

        // Remove donor from donorsCollection
        await donorsCollection.deleteOne({ _id: new ObjectId(id) });

        // Update donationsCollection -> reduce collectedAmount
        await donationsCollection.updateOne(
          { _id: new ObjectId(donor.donationId) },
          {
            $pull: { donorIds: new ObjectId(id) },
            $inc: { collectedAmount: -donor.amount },
          }
        );

        res.send({ success: true });
      } catch (error) {
        console.error("Refund error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::All dononrs api making here  end::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // payment api start hare
    app.post("/create-payment-intent", verifyFbToken, async (req, res) => {
      const amountInCents = req.body.amountInCents;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents, // Amount in cents
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // payment api end hare

  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

// mongo db all code end here

// my server root here
app.get("/", (req, res) => {
  res.send("Pet Adoption server");
});
app.listen(port, () => {
  // console.log(`pet adoption server is running port ${port} `);
});

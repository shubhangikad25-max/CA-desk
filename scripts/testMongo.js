
const { MongoClient } = require("mongodb");

const url = "mongodb://127.0.0.1:27017";
const client = new MongoClient(url);

async function main() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully!");

    // Select your existing database
    const db = client.db("TaxIncome");

    // Select your existing collection
    const collection = db.collection("Tax");

    // Insert sample documents
    const result = await collection.insertMany([
      { name: "John", address: "Highway 71" },
      { name: "Peter", address: "Lowstreet 4" },
      { name: "Amy", address: "Apple Street 652" }
    ]);

    console.log("Documents inserted:", result.insertedCount);
  } catch (error) {
    console.error("MongoDB error:", error.message);
  } finally {
    await client.close();
  }
}

main();

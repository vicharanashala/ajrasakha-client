
const mongoose = require("mongoose");

// Schema
const GoldenSchema = new mongoose.Schema({
  question: String,
  answer: String,
  crop: String,
  tags: [String]
});

// Model (connects to collection)
const Golden = mongoose.model("Golden", GoldenSchema, "golden_dataset");

// Search function
async function searchGolden(userQuery) {
  try {
    if (!userQuery) return null;

    const cleanQuery = userQuery.toLowerCase().trim();

    const result = await Golden.findOne({
      question: { $regex: cleanQuery, $options: "i" }
    });

    return result;

  } catch (error) {
    console.error("Golden search error:", error);
    return null;
  }
}
module.exports = { searchGolden };
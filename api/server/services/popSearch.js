console.log("POP FUNCTION CALLED");
const mongoose = require("mongoose");

const PopSchema = new mongoose.Schema({
  question: String,
  answer: String,
  crop: String,
  type: String
});

const Pop = mongoose.model("Pop", PopSchema, "pop_dataset");

async function searchPop(userQuery) {
  try {
    console.log("POP FUNCTION CALLED");
    console.log("POP QUERY:", userQuery);

    if (!userQuery) return null;

    const cleanQuery = userQuery
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

    const allData = await Pop.find({});

    const result = allData.find(item => {
      const dbQuestion = item.question
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .trim();

      return dbQuestion === cleanQuery;
    });

    //  ADD THIS LOG HERE
    console.log("POP MATCH RESULT:", result);

    return result || null;

  } catch (error) {
    console.error("PoP search error:", error);
    return null;
  }
}
module.exports = { searchPop };
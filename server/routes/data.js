const express = require("express");
const router = express.Router();
const dataController = require("../controllers/data-controller");

// Debug log (optional)
router.use((req, res, next) => {
  console.log("Incoming route:", req.method, req.originalUrl);
  next();
});

// Routes
router.get("/collections", dataController.getCollections);
router.get("/:risk/:symbol/search", dataController.searchData);
router.get("/:risk/:symbol/stats", dataController.getStats);
router.get("/:risk/:symbol/filter", dataController.filterData);
router.get("/:risk/:symbol", dataController.getData); // catch-all last

module.exports = router;

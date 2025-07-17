const express = require("express");
const router = express.Router();
const {saveEventFrame,selectedFarme,deleteFrame} = require("../controllers/event-details/customFrameController");

router.post("/save-frame", saveEventFrame);
router.put("/select-frame",selectedFarme);
router.delete("/delete-frame",deleteFrame);
module.exports = router;
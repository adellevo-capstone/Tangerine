const mongoose = require("mongoose");

const InviteResponseSchema = new mongoose.Schema({
  groupId: mongoose.ObjectId,
  guestId: mongoose.ObjectId,
  attending: Boolean,
  priceLevel: Number,
  distanceLevel: Number,
  availability: Object,
});

const InviteResponse = mongoose.model("InviteResponse", InviteResponseSchema);

module.exports = InviteResponse;

const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  title: String,
  hostId: mongoose.ObjectId,
  groupId: mongoose.ObjectId,
  description: String,
  location: String,
  rsvpDeadline: Date,
  time: String,
  timeSlots: {
    dateMap: Object,
    startTime: String,
  },
  members: [mongoose.ObjectId], // user ids
  attendance: {
    // inviteResponse ids
    going: [mongoose.ObjectId],
    notGoing: [mongoose.ObjectId],
    unconfirmed: [mongoose.ObjectId],
  },
});

const Invite = mongoose.model("Invite", InviteSchema);

module.exports = Invite;

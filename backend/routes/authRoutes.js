const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const axios = require("axios");

// models
const User = require("../models/user");
const Group = require("../models/group");
const Invite = require("../models/invite");
const InviteResponse = require("../models/inviteResponse");

// ---- Twilio ----

const accountSid = process.env.accountSid;
const authToken = process.env.authToken;
const client = require("twilio")(accountSid, authToken);

router.post("/sendText", (req, res) => {
  const message = req.body.address;
  client.messages
    .create({
      body: message,
      from: process.env.TWILIO_SENDER,
      to: process.env.TWILIO_RECEIVER,
    })
    .then((message) => {
      res.json({ message: message });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: error.message });
    });
});

// ---- Authentication ----

router.route("/signup").post(authController.signup);
router.route("/login").post(authController.login);
router.route("/logout").get(authController.logout);

// ---- Yelp API ----

const formatTime = (minuteOffset, startTime) => {
  let ending = "AM";
  let newHours = parseInt(startTime.substring(0, 2)) + parseInt(minuteOffset / 60);
  let minutes = startTime.substring(3);
  if (newHours > 12) {
    newHours -= 12;
    ending = "PM";
  }
  return `${newHours}:${minutes} ${ending}`;
};

const formatMilitaryTime = (minuteOffset, startTime) => {
  const formattedStart = startTime.length === 4 ? `0${startTime}` : startTime;
  let newHours = parseInt(formattedStart.substring(0, 2)) + parseInt(minuteOffset / 60);
  let minutes = formattedStart.substring(3);
  return newHours.toString().length == 1 ? `0${newHours}:${minutes}` : `${newHours}:${minutes}`;
};

router.get("/generateEventDetails/:eventId", authController.checkUser, async (req, res) => {
  try {
    const event = await Invite.findOne({ eventId: req.params.eventId });
    const going = await getInviteResponseDetails(event.attendance.going);
    const { startTime, dateMap } = event?.timeSlots;

    // initialize hashmap: keys = dates, values = array of time slot frequency
    let dates = Array.from(Object.keys(dateMap));
    let groupAvailability = new Map();
    dates.forEach((date) => groupAvailability.set(date, new Array(10).fill(0)));

    // update hashmap with appropriate time slot frequencies
    for (let i = 0; i < going.length; i++) {
      let guestDates = Array.from(Object.keys(going[i].availability));
      guestDates.forEach((date) => {
        let times = going[i].availability[date];
        times.forEach((time) => {
          groupAvailability.get(date)[time] += 1;
        });
      });
    }

    let bestTimesByDate = new Map();
    groupAvailability.forEach((timeSlotIndices, date) => {
      let maxFrequency = Math.max(...timeSlotIndices);
      bestTimesByDate[date] = {
        frequency: maxFrequency,
        slotIndex: timeSlotIndices.indexOf(maxFrequency),
      };
    });

    // get date and time
    const times = Object.keys(bestTimesByDate);
    let optimalDateAndTime = { date: times[0], time: bestTimesByDate[times[0]] };
    for (let i = 1; i < times.length; i++) {
      if (optimalDateAndTime.frequency > times[i].frequency) {
        optimalDateAndTime = { date: times[i], time: bestTimesByDate[times[i]] };
      }
    }

    // calculate time
    const formattedTime = formatTime(optimalDateAndTime.time.slotIndex * 30, startTime);

    // get min price & distance level
    const optimalPriceLevel = going.reduce((prev, current) => {
      return prev.priceLevel < current.priceLevel ? prev.priceLevel : current.priceLevel;
    });
    const optimalDistanceLevel = going.reduce((prev, current) => {
      return prev.distanceLevel < current.distanceLevel
        ? prev.distanceLevel
        : current.distanceLevel;
    });

    // establish weights based on frequency of category appearances in group
    let categoryWeights = new Map();
    for (let i = 0; i < event.attendance.going.length; i++) {
      const { guestId } = await InviteResponse.findById(event.attendance.going[i]);
      const groupMember = await User.findById(guestId);
      const likes = groupMember?.dietaryProfile?.likes;
      const categories = likes.length < 3 ? likes : likes.slice(0, 3); // pick user's 3 most recently added categories
      categories.forEach((category) => {
        if (categoryWeights[category]) {
          categoryWeights[category] += 1;
        } else {
          categoryWeights[category] = 1;
        }
      });
    }

    let finalRestaurants = [];
    const unixTime = Math.round(new Date("2013/09/05 15:34:00").getTime() / 1000); // for expiration
    const open_at = "1658360817";
    const categories = Object.keys(categoryWeights);
    const milesToMetersMultiplier = 1609;

    // make requests based on like weights
    for (let i = 0; i < categories.length; i++) {
      let limit = categoryWeights[categories[i]] * 2;
      let response = await axios.get(`https://api.yelp.com/v3/businesses/search`, {
        headers: {
          Authorization: `Bearer ${process.env.YELP_API_KEY}`,
        },
        params: {
          location: event.location,
          limit: limit,
          radius: optimalDistanceLevel.distanceLevel * milesToMetersMultiplier,
          price: optimalPriceLevel.priceLevel,
          categories: categories[i].toLowerCase(),
        },
      });

      const restaurants = response.data.businesses;
      restaurants.forEach((restaurant) => {
        const restaurantSummary = { id: restaurant.id, name: restaurant.name };
        finalRestaurants.push(restaurantSummary);
      });
    }

    // update invite
    await Invite.findOneAndUpdate(
      { _id: req.params.eventId },
      {
        $set: {
          date: optimalDateAndTime.date,
          time: formatMilitaryTime(optimalDateAndTime.time.slotIndex * 30, startTime),
        },
      }
    );

    const response = {
      options: [...new Set(finalRestaurants)],
      date: optimalDateAndTime.date,
      time: formattedTime,
    };
    console.log(response);
    res.status(201).json(response);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.patch("/event/:eventId/update", authController.checkUser, async (req, res) => {
  try {
    let update = req.body;
    let event = await Invite.findByIdAndUpdate(req.params.eventId, update, {
      new: true,
    });

    res.status(201).json(event);
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// get data on specific restaurant
router.post("/restaurantInfo", authController.checkUser, async (req, res) => {
  try {
    const { location, searchQuery } = req.body;
    const response = await axios.get(`https://api.yelp.com/v3/businesses/search`, {
      headers: {
        Authorization: `Bearer ${process.env.YELP_API_KEY}`,
      },
      params: {
        term: searchQuery,
        location: location,
        limit: 5,
      },
    });
    const restaurantData = response.data.businesses;
    res.status(201).json(restaurantData);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ---- All users ----

router.get("/allUsers", authController.checkUser, async (req, res) => {
  try {
    const allUsers = await User.find({ _id: { $ne: req.user._id } });
    res.status(201).json(allUsers);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// ---- Events ----

// get events
router.get("/events", authController.checkUser, async (req, res) => {
  try {
    const eventIds = req.user.events;
    let eventsHosted = [];
    let eventsInvitedTo = [];

    for (let i = 0; i < eventIds.length; i++) {
      const eventInfo = await Invite.findById(eventIds[i]);
      if (eventInfo.hostId.equals(req.user._id)) {
        eventsHosted.push(eventInfo);
      } else {
        eventsInvitedTo.push(eventInfo);
      }
    }
    res.status(201).json({ hosted: eventsHosted, invitedTo: eventsInvitedTo });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// add group or event ids to corresponding user's profiles
const updateMemberProfiles = async (arrayType, createdItemId, memberIds) => {
  for (let i = 0; i < memberIds.length; i++) {
    let member = await User.findById(memberIds[i]);
    // don't include duplicates
    if (!member[arrayType].some((itemId) => itemId.equals(createdItemId))) {
      member[arrayType].unshift(createdItemId);
    }
    member.save();
  }
};

// create event
router.patch("/event/create", authController.checkUser, async (req, res) => {
  try {
    const { dateMap, startTime } = req.body.timeSlots;
    const { status, capacity, startingPoint } = req.body.carpool;

    const hostResponse = await InviteResponse.create({
      groupId: req.body.groupId,
      guestId: req.user._id,
      attending: true,
      priceLevel: parseInt(req.body.priceLevel),
      distanceLevel: parseInt(req.body.distanceLevel),
      availability: dateMap,
      carpoolStatus: status,
    });

    const newEvent = await Invite.create({
      title: req.body.title,
      hostId: req.user._id,
      groupId: req.body.groupId,
      description: req.body.description,
      location: req.body.location,
      rsvpDeadline: new Date(req.body.rsvpDeadline),
      timeSlots: { dateMap: dateMap, startTime: startTime },
      members: req.body.members,
      attendance: {
        going: [hostResponse._id],
        notGoing: [],
      },
      carpool: {},
    });

    hostResponse.eventId = newEvent._id;
    hostResponse.save();

    let unconfirmed = [];
    const guests = newEvent.members.filter((memberId) => !memberId.equals(newEvent.hostId));

    for (let i = 0; i < guests.length; i++) {
      const defaultGuestResponse = await InviteResponse.create({
        eventId: newEvent._id,
        groupId: req.body.groupId,
        guestId: guests[i],
      });
      unconfirmed.push(defaultGuestResponse._id);
    }

    newEvent.attendance.unconfirmed = [...unconfirmed];

    // update carpool status
    const userName = `${req.user.firstName} ${req.user.lastName}`;

    if (status === "driver") {
      newEvent.carpool.groups.push({
        driver: userName,
        capacity: parseInt(capacity),
        startingPoint: startingPoint,
        passengers: [],
      });
    } else if (status === "passenger") {
      newEvent.carpool.passengers.push(req.user._id);
    }

    newEvent.save();
    await updateMemberProfiles("events", newEvent._id, newEvent.members);

    res.status(201).json({ createdEvent: newEvent });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// update carpool
router.patch("/event/:id/carpool", authController.checkUser, async (req, res) => {
  try {
    const { groups, passengers } = req.body;

    const updatedEvent = await Invite.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          "carpool.groups": groups,
          "carpool.passengers": passengers,
        },
      },
      { new: true }
    );

    res.status(201).json({ updatedCarpool: updatedEvent.carpool });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// get group name based on event id
router.get("/groupName/:eventId", authController.checkUser, async (req, res) => {
  try {
    const eventInfo = await Invite.findById(req.params.eventId);
    const group = await Group.findById(eventInfo.groupId);
    res.status(201).json(group);
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// ---- InviteResponse ----

const getInviteResponseDetails = async (attendanceArray) => {
  let details = [];
  for (let i = 0; i < attendanceArray.length; i++) {
    const inviteResponse = await InviteResponse.findById(attendanceArray[i]);
    const { guestId, attending, location, priceLevel, distanceLevel, availability } =
      inviteResponse;
    const guest = await User.findById(guestId);
    details.push({
      name: `${guest.firstName} ${guest.lastName}`,
      attending,
      location,
      priceLevel,
      distanceLevel,
      availability,
    });
  }
  return details;
};

router.get("/inviteResponses/:eventId", authController.checkUser, async (req, res) => {
  try {
    const event = await Invite.findOne({ eventId: req.params.eventId });
    const going = await getInviteResponseDetails(event.attendance.going);
    const notGoing = await getInviteResponseDetails(event.attendance.notGoing);
    const unconfirmed = await getInviteResponseDetails(event.attendance.unconfirmed);

    res.status(201).json({ going: going, notGoing: notGoing, unconfirmed: unconfirmed });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.get("/inviteResponse/:eventId/:userId", authController.checkUser, async (req, res) => {
  try {
    const inviteResponse = await InviteResponse.findOne({
      eventId: req.params.eventId,
      guestId: req.params.userId,
    });
    res.status(201).json(inviteResponse);
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.patch("/inviteResponse/update", authController.checkUser, async (req, res) => {
  try {
    // update existing invite response
    const filters = {
      groupId: req.body.groupId,
      guestId: req.user._id,
    };
    let update = { ...req.body, guestId: req.user._id, carpoolStatus: req.body.carpool.status };
    let inviteResponse = await InviteResponse.findOneAndUpdate(filters, update, { new: true });

    // ---- Update attendance ----

    // remove invite response id from unconfirmed array
    let updatedEvent = await Invite.findByIdAndUpdate(
      req.body.eventId,
      { $pull: { ["attendance.unconfirmed"]: inviteResponse._id } },
      { new: true }
    );

    // add invite response id to going array
    if (req.body.attending) {
      updatedEvent = await Invite.findByIdAndUpdate(
        req.body.eventId,
        { $addToSet: { ["attendance.going"]: inviteResponse._id } },
        { new: true }
      );
    }
    // add invite response id to notGoing array
    else {
      updatedEvent = await Invite.findByIdAndUpdate(
        req.body.eventId,
        { $addToSet: { ["attendance.notGoing"]: inviteResponse._id } },
        { new: true }
      );
    }

    // ---- Update carpool ----

    const { status, capacity, startingPoint } = req.body.carpool;
    const userName = `${req.user.firstName} ${req.user.lastName}`;

    // ---- Remove old data ----

    updatedEvent = await Invite.findByIdAndUpdate(
      req.body.eventId,
      { $pull: { ["carpool.passengers"]: req.user._id } },
      { new: true }
    );

    updatedEvent = await Invite.findByIdAndUpdate(
      req.body.eventId,
      { $pull: { "carpool.groups": { driver: userName } } },
      { new: true }
    );

    // ---- Update data in event ----

    if (status === "driver") {
      const newGroup = {
        driver: userName,
        capacity: parseInt(capacity),
        startingPoint: startingPoint,
        passengers: [],
      };
      updatedEvent = await Invite.findByIdAndUpdate(
        req.body.eventId,
        { $addToSet: { ["carpool.groups"]: newGroup } },
        { new: true }
      );
    } else if (status === "passenger") {
      updatedEvent = await Invite.findByIdAndUpdate(
        req.body.eventId,
        { $addToSet: { ["carpool.passengers"]: req.user._id } },
        { new: true }
      );
    } else {
    }

    res.status(201).json({ inviteResponse: inviteResponse, updatedEvent: updatedEvent });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// ---- Groups ----

// get all groups
router.get("/group", authController.checkUser, async (req, res) => {
  try {
    const groupIds = req.user.groups;
    let groupData = [];
    let memberInfo = [];

    for (let i = 0; i < groupIds.length; i++) {
      const groupInfo = await Group.findById(groupIds[i]);

      for (let i = 0; i < groupInfo.members.length; i++) {
        const member = await User.findById(groupInfo.members[i]);
        memberInfo.push(member);
      }

      const groupToAdd = {
        memberInfo: memberInfo,
        groupInfo: groupInfo,
      };

      groupData.push(groupToAdd);
      memberInfo = [];
    }
    res.status(201).json({ groups: groupData });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.get("/group/:id", authController.checkUser, async (req, res) => {
  try {
    const groupInfo = await Group.findById(req.params.id);
    let memberInfo = [];

    for (let i = 0; i < groupInfo.members.length; i++) {
      const member = await User.findById(groupInfo.members[i]);
      memberInfo.push(member);
    }

    res.status(201).json({ groupName: groupInfo.name, groupId: groupInfo._id, groups: memberInfo });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// create group
router.patch("/group/create", authController.checkUser, async (req, res) => {
  try {
    const allMembers = [req.user._id, ...req.body.members];
    const newGroup = await Group.create({
      name: req.body.name,
      members: allMembers,
    });
    await updateMemberProfiles("groups", newGroup._id, allMembers);

    res.status(201).json({ createdGroup: newGroup });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// add members to group
router.patch("/group/:id/addMembers", authController.checkUser, async (req, res) => {
  try {
    const membersToAdd = req.body.members;

    // add members to group while preventing duplicates
    const group = await Group.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: { $each: membersToAdd } } },
      { new: true }
    );

    await updateMemberProfiles("groups", req.params.id, membersToAdd);

    res.status(201).json({ group: group });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// remove members from group
router.patch("/group/:id/leave", authController.checkUser, async (req, res) => {
  try {
    // remove group from user's profile
    req.user.groups = req.user.groups.filter((groupId) => !groupId.equals(req.params.id));
    req.user.save();

    // remove user from group
    const group = await Group.findById(req.params.id);
    group.members = group.members.filter((member) => !member.equals(req.user._id));
    group.save();

    res.status(201).json({ userGroups: req.user.groups, group: group });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

// ---- User information ----

router.get("/user", authController.checkUser, async (req, res) => {
  try {
    res.status(201).json({ user: req.user });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.get("/dietaryProfile", authController.checkUser, async (req, res) => {
  try {
    res.status(201).json({ dietaryProfile: req.user.dietaryProfile });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.patch("/dietaryProfile/modify", authController.checkUser, async (req, res) => {
  try {
    const sectionType =
      req.body.sectionType === "favoriteRestaurants"
        ? "favoriteRestaurants"
        : req.body.sectionType.toLowerCase();

    await User.findByIdAndUpdate(
      req.user._id,
      { $set: { ["dietaryProfile." + sectionType]: req.body.updatedArray } },
      { new: true }
    );

    res.status(201).json({ favoriteRestaurants: req.user.dietaryProfile.favoriteRestaurants });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.patch("/dietaryProfile/addRestaurants", authController.checkUser, async (req, res) => {
  try {
    const newRestaurants = req.body.restaurantsToAdd;

    // ---- update favorite restaurants ----

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: {
          ["dietaryProfile.favoriteRestaurants"]: {
            $each: newRestaurants,
          },
        },
      },
      { new: true }
    );

    // ---- update likes category ----

    let categories = [];
    for (let i = 0; i < newRestaurants.length; i++) {
      newRestaurants[i].categories.forEach((category) => categories.push(category.title));
    }

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: {
          ["dietaryProfile.likes"]: {
            $each: categories,
          },
        },
      },
      { new: true }
    );

    res.status(201).json({ user: req.user });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.use(authController.secure);

module.exports = router;

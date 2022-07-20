const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const User = require("../models/user");
const Group = require("../models/group");
const Invite = require("../models/invite");
const InviteResponse = require("../models/inviteResponse");
const axios = require("axios");

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

    // get min price & distance level (update to just driver later)
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

    // unixtime
    // Math.round(new Date("2013/09/05 15:34:00").getTime()/1000)

    let finalRestaurants = [];
    // const location = "San Jose";
    const open_at = "1658360817";
    const categories = Object.keys(categoryWeights);

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
          distance: optimalDistanceLevel,
          price: optimalPriceLevel,
          categories: categories[i].toLowerCase(),
        },
      });

      const restaurants = response.data.businesses;
      restaurants.forEach((restaurant) => {
        const restaurantSummary = { id: restaurant.id, name: restaurant.name };
        finalRestaurants.push(restaurantSummary);
      });
    }

    res.status(201).json({
      options: [...new Set(finalRestaurants)],
      date: optimalDateAndTime.date,
      time: formattedTime,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// get data on specific restaurant
router.post("/restaurantInfo", authController.checkUser, async (req, res) => {
  try {
    const { location, searchQuery } = req.body;
    const response = await axios.get(
      `https://api.yelp.com/v3/businesses/search?term=${searchQuery}&location=${location}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.YELP_API_KEY}`,
        },
      }
    );
    const restaurantData = response.data.businesses[0];
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
    member[arrayType].unshift(createdItemId);
    member.save();
  }
};

// create event
router.patch("/event/create", authController.checkUser, async (req, res) => {
  try {
    const { dateMap, startTime } = req.body.timeSlots;

    const hostResponse = await InviteResponse.create({
      groupId: req.body.groupId,
      guestId: req.user._id,
      attending: true,
      priceLevel: parseInt(req.body.priceLevel),
      distanceLevel: parseInt(req.body.distanceLevel),
      availability: dateMap,
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
    });

    let unconfirmed = [];
    const guests = newEvent.members.filter((memberId) => !memberId.equals(newEvent.hostId));

    for (let i = 0; i < guests.length; i++) {
      const defaultGuestResponse = await InviteResponse.create({
        groupId: req.body.groupId,
        guestId: guests[i],
      });
      unconfirmed.push(defaultGuestResponse._id);
    }

    newEvent.attendance.unconfirmed = [...unconfirmed];
    newEvent.save();

    await updateMemberProfiles("events", newEvent._id, newEvent.members);

    res.status(201).json({ createdEvent: newEvent });
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

router.patch("/inviteResponse/update", authController.checkUser, async (req, res) => {
  try {
    // update existing invite response
    const filters = {
      groupId: req.body.groupId,
      guestId: req.user._id,
    };
    let update = req.body;
    update.guestId = req.user._id;
    let inviteResponse = await InviteResponse.findOneAndUpdate(filters, update, { new: true });

    // remove invite response id from unconfirmed array
    let updatedEvent = await Invite.findByIdAndUpdate(
      req.body.eventId,
      { $pull: { ["attendance.unconfirmed"]: inviteResponse._id } },
      { returnNewDocument: true }
    );

    // add invite response id to going array
    if (req.body.attending) {
      updatedEvent = await Invite.findByIdAndUpdate(
        req.body.eventId,
        { $addToSet: { ["attendance.going"]: inviteResponse._id } },
        { returnNewDocument: true }
      );
    }
    // add invite response id to notGoing array
    else {
      updatedEvent = await Invite.findByIdAndUpdate(
        req.body.eventId,
        { $addToSet: { ["attendance.notGoing"]: inviteResponse._id } },
        { returnNewDocument: true }
      );
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
    // add user ids to group
    const membersToAdd = req.body.members;
    const group = await Group.findById(req.params.id);
    group.members = group.members.concat(membersToAdd);
    group.save();

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
    const sectionType = req.body.sectionType.toLowerCase();

    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { ["dietaryProfile." + sectionType]: { $each: req.body.updatedArray } } },
      { returnNewDocument: true }
    );

    res.status(201).json({ user: req.user });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.patch("/dietaryProfile/addRestaurant", authController.checkUser, async (req, res) => {
  try {
    const newRestaurant = req.body.restaurantToAdd;

    req.user.dietaryProfile.favoriteRestaurants.unshift(newRestaurant);
    req.user.save();

    res.status(201).json({ user: req.user });
  } catch (error) {
    res.status(500).send(error.message);
    console.log(error);
  }
});

router.use(authController.secure);

module.exports = router;

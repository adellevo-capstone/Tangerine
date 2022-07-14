import React, { useState, useEffect } from "react";
import DateContainer from "./DateContainer";
import "./EventForm.css";
import TimeSlot from "./TimeSlot";
// import Moment from "react-moment";
// import "moment-timezone";

export default function ResponseTimeGrid(props) {
  // const [startTime, setStartTime] = useState("00:00");
  const slotDates = [0, 2, 4, 6, 8, 10];
  // const [availableTimes, props.setAvailableTimes] = useState(new Map());
  // const [slotDays, setSlotDays] = useState(["", "", "", ""]);

  const addAvailability = (date, slotIndex) => {
    let currentTimesArray = props.availableTimes.get(date); // get array
    if (currentTimesArray) {
      props.setAvailableTimes((map) => new Map(map.set(date, [slotIndex, ...currentTimesArray])));
    } else {
      props.setAvailableTimes((map) => new Map(map.set(date, [slotIndex])));
    }
  };

  // helper function to remove map keys
  const deleteDate = (date) => {
    props.setAvailableTimes((map) => {
      let mapCopy = new Map(map);
      mapCopy.delete(date);
      return mapCopy;
    });
  };

  const removeAvailability = (date, slotIndex) => {
    let currentTimesArray = props.availableTimes.get(date);
    if (currentTimesArray) {
      // remove time slot from date's slot array
      const index = currentTimesArray.indexOf(slotIndex);
      props.setAvailableTimes((map) => new Map(map.set(date, currentTimesArray.splice(index, 1))));

      // remove date if number of slots goes down to 0
      if (currentTimesArray.length === 0) {
        deleteDate(date);
      }
    }
  };

  const updateAvailability = (prevDate, newDate) => {
    if (props.availableTimes.size > 0) {
      // create new date with times from old date
      props.setAvailableTimes(
        (map) => new Map(map.set(newDate, props.availableTimes.get(prevDate)))
      );
      deleteDate(prevDate);
    }
    // console.log(availableTimes);
  };

  //   let minutesToAdd = 30;
  //   let currentDate = new Date();
  //   let futureDate = new Date(currentDate.getTime() + minutesToAdd * 60000);
  //   console.log(futureDate);

  const formatTime = (minuteOffset) => {
    let ending = "AM";
    let newHours = parseInt(props.startTime.substring(0, 2)) + parseInt(minuteOffset / 60);
    let minutes = props.startTime.substring(3);
    if (newHours > 12) {
      newHours -= 12;
      ending = "PM";
    }
    return `${newHours}:${minutes} ${ending}`;
    // let newHours = parseInt(startTime.substring(0, 2)) + parseInt(minuteOffset / 60);
    // let newMinutes = parseInt(startTime.substring(2)) + parseInt(minuteOffset % 60);
    // if (newMinutes === 0) {
    //   newMinutes = "00";
    // }
    // return `${newHours}:${newMinutes} ${ending}`;
  };

  return (
    <div className="time-grid">
      <div className="left-container">
        {props.startTime !== "00:00" && (
          <div className="times">
            {/* {console.log(startTime.substring(0, 2))} */}
            {slotDates.map((index) => (
              <p>{formatTime(index * 30)}</p>
            ))}
          </div>
        )}
      </div>

      <div className="slots">
        {[1, 2, 3, 4].map((index) => (
          <DateContainer
            key={index}
            availableTimes={props.availableTimes}
            addAvailability={addAvailability}
            removeAvailability={removeAvailability}
            updateAvailability={updateAvailability}
            // slotDays={slotDays}
            // setSlotDays={setSlotDays}
          />
        ))}
      </div>
    </div>
  );
}

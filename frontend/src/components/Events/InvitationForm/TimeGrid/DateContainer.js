import React, { useState, useEffect, useRef } from "react";
import TimeSlot from "./TimeSlot";

export default function DateContainer(props) {
  const slotContainers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const [prevDate, setPrevDate] = useState("");
  const [currDate, setCurrDate] = useState("");

  const isValidSlot = (index) => {
    if (!props.guest) {
      return true;
    } else {
      return props.hostAvailability[props.currDate].includes(index);
    }
  };

  useEffect(() => {
    if (prevDate && prevDate !== "") {
      props.updateAvailability(prevDate, currDate);
    }
  }, [currDate]);

  useEffect(() => {
    if (props.guest) {
      setCurrDate(props.currDate);
    }
  }, []);

  return (
    <div className="date-container">
      {/* only display input for host */}
      <div className="current-date">
        {props.guest ? (
          <input
            type="date"
            className="date"
            value={currDate}
            readOnly
          />
        ) : (
          <input
            type="date"
            className="date"
            onClick={(e) => {
              setPrevDate(e.target.value);
            }}
            onChange={(e) => {
              setCurrDate(e.target.value);
            }}
          />
        )}
      </div>
      <div className="date-slots">
        {currDate || props.guest ? (
          slotContainers.map((index) => (
            <TimeSlot
              validSlot={isValidSlot(index)}
              previouslySelected={
                props.availableTimes.has(currDate) &&
                props.availableTimes.get(currDate).includes(index)
              }
              key={index}
              date={currDate}
              slotIndex={index}
              availableTimes={props.availableTimes}
              addAvailability={props.addAvailability}
              removeAvailability={props.removeAvailability}
              updateAvailability={props.updateAvailability}
              rsvpStatus={props.rsvpStatus}
              rsvpOpen={props.rsvpOpen}
            />
          ))
        ) : (
          // prevent people from being able to pick time slots when date isn't defined
          <p>Select a date </p>
        )}
      </div>
    </div>
  );
}

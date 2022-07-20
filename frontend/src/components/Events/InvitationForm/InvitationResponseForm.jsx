import React, { useState } from "react";
import TimeGrid from "./TimeGrid/TimeGrid";
import Popup from "reactjs-popup";
import API from "../../../utils/API";

export default function InvitationResponseForm(props) {
  const [rsvpStatus, setRSVPStatus] = useState("unconfirmed");

  const submitRSVP = async (event) => {
    try {
      // get form data
      event.preventDefault();
      const config = { headers: { "Content-Type": "application/json" } };
      const elements = event.currentTarget.elements;

      const intendedGroup = props.groups.find((group) => group.groupInfo.name === props.groupName);

      const body = {
        eventId: props.eventId,
        groupId: intendedGroup.groupInfo._id,
        attending: rsvpStatus === "accept" ? true : false,
        priceLevel: parseInt(elements.priceLevel.value),
        distanceLevel: parseInt(elements.distanceLevel.value),
        availability: Object.fromEntries(props.availableTimes),
      };

      await API.patch("api/v1/auth/inviteResponse/update", body, config);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <Popup
      closeOnDocumentClick
      modal
      nested
      trigger={<button> Fill out RSVP </button>}
    >
      <div
        style={{
          backgroundColor: "white",
          boxShadow: "rgba(149, 157, 165, 0.2) 0px 8px 24px",
          padding: "0.5em",
          borderRadius: "2em",
        }}
      >
        <div>
          <button onClick={() => setRSVPStatus("accept")}>Accept</button>
          <button onClick={() => setRSVPStatus("decline")}>Decline</button>
          {rsvpStatus === "accept" && (
            <form onSubmit={(event) => submitRSVP(event)}>
              <div className="content">
                <div className="planning">
                  <fieldset className="time-slot-field">
                    <legend>Pick time slots</legend>
                    <TimeGrid
                      hostAvailability={props.hostAvailability}
                      guest={true}
                      startTime={props.startTime}
                      setStartTime={props.setStartTime}
                      availableTimes={props.availableTimes}
                      setAvailableTimes={props.setAvailableTimes}
                    />
                  </fieldset>
                </div>

                <div className="filters">
                  <fieldset>
                    <legend>Transportation</legend>
                    <select
                      id="transportation"
                      selected
                      required
                    >
                      <option
                        value=""
                        disabled
                      >
                        Select carpool needs
                      </option>
                      <option value="driver">Driver</option>
                      <option value="rider">Rider</option>
                      <option value="none">N/A</option>
                    </select>
                  </fieldset>

                  <fieldset>
                    <legend>Price Level</legend>
                    {["<$10", "$11-30", "$31-60", "$61+"].map((label, index) => (
                      <div>
                        <input
                          key={index}
                          id={label}
                          name="priceLevel"
                          type="radio"
                          value={index + 1}
                          required
                        />
                        <label htmlFor={label}>{label}</label>
                      </div>
                    ))}
                  </fieldset>

                  <fieldset>
                    <legend>Distance</legend>
                    {["level-1", "level-2", "level-3", "level-4"].map((label, index) => (
                      <div>
                        <input
                          key={index}
                          id={label}
                          name="distanceLevel"
                          type="radio"
                          value={index + 1}
                          required
                        />
                        <label htmlFor={label}>{index + 1}</label>
                      </div>
                    ))}
                  </fieldset>
                </div>
              </div>
              <button type="submit">Submit</button>
            </form>
          )}
        </div>
      </div>
    </Popup>
  );
}

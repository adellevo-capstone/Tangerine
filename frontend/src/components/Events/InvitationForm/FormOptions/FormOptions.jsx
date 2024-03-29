import React, { useState, useEffect } from "react";
import TimeGrid from "../TimeGrid/TimeGrid.js";
import LocationSearchInput from "../LocationSearchInput.jsx";
import PageDots from "./PageDots/PageDots.jsx";
import "../assets/InvitationForm.css";
import "./FormOptions.css";
import "./PageDots/PageDots.css";

const GroupSelect = ({ groups, selectedGroup, setSelectedGroup }) => (
  <select
    className="groups"
    value={selectedGroup}
    onChange={(e) => setSelectedGroup(e.target.value)}
    required
  >
    {groups.map((group, index) => (
      <option
        key={index}
        value={group.groupInfo._id}
      >
        {group.groupInfo.name}
      </option>
    ))}
  </select>
);

const RSVPDeadline = ({ rsvpDeadline, setRsvpDeadline }) => (
  <input
    className="datetimeInput"
    type="datetime-local"
    value={rsvpDeadline}
    onChange={(e) => setRsvpDeadline(e.target.value)}
    required
  />
);

const PriceLevel = ({ priceLevel, setPriceLevel }) => (
  <select
    className="price-level"
    value={priceLevel}
    onChange={(e) => setPriceLevel(e.target.value)}
    required
  >
    {["< $10", "$11 - 30", "$31 - 60", "$61+"].map((label, index) => (
      <option
        key={index}
        value={index + 1}
      >
        {label}
      </option>
    ))}
  </select>
);

const SearchRadius = ({ searchRadius, setSearchRadius }) => (
  <input
    className="search-radius"
    type="number"
    placeholder={0}
    value={searchRadius}
    onChange={(e) => setSearchRadius(e.target.value)}
    required
  />
);

const Test = (props) => (
  <select
    name="test"
    aria-invalid="false"
  >
    <option value="Tomato">Tomato</option>
    <option value="Banana">Banana</option>
    <option value="Apple">Apple</option>
  </select>
);

export default function FormOptions(props) {
  const [pageNumber, setPageNumber] = useState(1);
  const [firstSectionClasses, setFirstSectionClasses] = useState("filters");
  const [secondSectionClasses, setSecondSectionClasses] = useState("form-field");
  const [thirdSectionClasses, setThirdSectionClasses] = useState("form-field carpool");

  // useEffect(() => {
  //   if (pageNumber === 1) {
  //     setFirstSectionClasses("filters visible");
  //     setSecondSectionClasses("form-field hidden");
  //     setThirdSectionClasses("form-field carpool hidden");
  //   } else if (pageNumber === 2) {
  //     setFirstSectionClasses("filters hidden");
  //     setSecondSectionClasses("form-field");
  //     setThirdSectionClasses("form-field carpool hidden");
  //   } else {
  //     setFirstSectionClasses("filters hidden");
  //     setSecondSectionClasses("form-field hidden");
  //     setThirdSectionClasses("form-field carpool");
  //   }
  // }, [pageNumber]);

  return (
    <div className="form-options">
      <form
        className="form-options-content"
        onSubmit={(event) => props.handleOnSubmit(event)}
      >
        <div>
          {pageNumber === 1 ? (
            <div className={firstSectionClasses}>
              <h2>Let's get started.</h2>
              {!props.isGuestResponse && (
                <>
                  <div className="form-field">
                    <h3 className="label">Give your event a title.</h3>
                    <input
                      className="title"
                      required
                      value={props.title}
                      onChange={(e) => props.setTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <h3 className="label">
                      Provide your guests with some details about the event.
                    </h3>
                    <textarea
                      className="description"
                      required
                      value={props.description}
                      onChange={(e) => props.setDescription(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="form-field">
                <h3 className="label">
                  Tell us a little bit more about the event you’re trying to plan.
                </h3>
                <span className="fill-in-the-blanks">
                  I would like to plan a group outing with{" "}
                  <GroupSelect
                    groups={props.groups}
                    selectedGroup={props.selectedGroup}
                    setSelectedGroup={props.setSelectedGroup}
                  />
                  , and I want to give everyone <br />
                  until
                  <RSVPDeadline
                    rsvpDeadline={props.rsvpDeadline}
                    setRsvpDeadline={props.setRsvpDeadline}
                  />
                  to fill out their RSVP form. I’m looking for a restaurant <br />
                  that’s located within{" "}
                  <SearchRadius
                    searchRadius={props.searchRadius}
                    setSearchRadius={props.setSearchRadius}
                  />{" "}
                  miles of{" "}
                  <LocationSearchInput
                    className="restaurant-location"
                    address={props.restaurantLocation}
                    setAddress={props.setRestaurantLocation}
                  />
                  , and my <br />
                  budget is{" "}
                  <PriceLevel
                    priceLevel={props.priceLevel}
                    setPriceLevel={props.setPriceLevel}
                  />
                  .
                </span>
              </div>
            </div>
          ) : pageNumber === 2 ? (
            <div className={secondSectionClasses}>
              {!props.isGuestResponse ? (
                <div>
                  <h2>Select potential time slots for your event.</h2>

                  <TimeGrid
                    startTime={props.startTime}
                    setStartTime={props.setStartTime}
                    availableTimes={props.availableTimes}
                    setAvailableTimes={props.setAvailableTimes}
                  />
                </div>
              ) : (
                <TimeGrid
                  hostAvailability={props.hostAvailability}
                  guest={true}
                  startTime={props.startTime}
                  setStartTime={props.setStartTime}
                  availableTimes={props.availableTimes}
                  setAvailableTimes={props.setAvailableTimes}
                  loadPreviousRSVP={props.loadPreviousRSVP}
                  rsvpStatus={props.rsvpStatus}
                  rsvpOpen={props.rsvpOpen}
                />
              )}
            </div>
          ) : (
            <div className={thirdSectionClasses}>
              <h2>Almost there! Let's simplify the process of forming carpool groups.</h2>
              <div className="form-field">
                <h3 className="label">What's your transportation situation?</h3>
                <select
                  className="carpool-status"
                  selected
                  required
                  value={props.transportation}
                  onChange={(e) => props.setTransportation(e.target.value)}
                >
                  <option
                    value=""
                    disabled
                  >
                    Select an option
                  </option>
                  <option value="driver">I can offer a ride.</option>
                  <option value="passenger">I need a ride.</option>
                  <option value="none">I'm not interested in being part of a carpool group.</option>
                </select>
              </div>
              {props.transportation === "driver" && (
                <div>
                  <div className="form-field">
                    <h3 className="label">How many passengers can you drive?</h3>
                    <input
                      className="car-capacity"
                      type="number"
                      value={props.carCapacity}
                      onChange={(e) => props.setCarCapacity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <h3 className="label">Where will you start driving from?</h3>
                    <LocationSearchInput
                      className="starting-point"
                      address={props.startingPoint}
                      setAddress={props.setStartingPoint}
                    />
                  </div>
                </div>
              )}
              <button
                className="button"
                type="submit"
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </form>
      {/* navigate between event form sections */}
      <PageDots
        pageNumber={pageNumber}
        setPageNumber={setPageNumber}
      />
    </div>
  );
}

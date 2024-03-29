import React, { useState, useEffect } from "react";
import API from "../../utils/API";
import Popup from "reactjs-popup";
import InvitationForm from "./InvitationForm/InvitationForm";
import InvitationCard from "./InvitationForm/InvitationCard";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import map from "../Shared/assets/Map.svg";
import car from "../Shared/assets/Car.svg";
import people from "../Shared/assets/People.svg";
import DeleteButton from "../Shared/assets/DeleteButton.svg";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import TaskBoard from "./InvitationForm/DND/TaskBoard";
import "./Event.css";

export default function Event(props) {
  const [error, setError] = useState("");
  const [hosted, setHosted] = useState([]);
  const [invitedTo, setInvitedTo] = useState([]);
  const [startTime, setStartTime] = useState("00:00");
  const [availableTimes, setAvailableTimes] = useState(new Map());
  const [selectedEvent, setSelectedEvent] = useState({});
  const [allEvents, setAllEvents] = useState([]);

  let passengers = [];
  if (Object.keys(selectedEvent).length > 0) {
    passengers.push({
      title: "Passengers",
      passengers: selectedEvent?.carpool?.passengers,
    });
    const carpoolData = selectedEvent?.carpool?.groups;
    for (let i = 0; i < carpoolData.length; i++) {
      passengers.push({
        ...carpoolData[i],
        title: carpoolData[i].driver,
        passengers: carpoolData[i].passengers,
      });
    }
  }

  useEffect(() => {
    loadAllEvents();
  }, []);

  const loadAllEvents = async () => {
    try {
      const res = await API.get("api/v1/auth/events");
      setHosted(res.data.hosted);
      setInvitedTo(res.data.invitedTo);

      const events = [...res.data.hosted, ...res.data.invitedTo];
      const reformattedEvents = events.map((item) => ({
        start: `${item.date}T${item.time}`,
        ...item,
      }));

      setAllEvents(reformattedEvents);
    } catch (err) {
      setError(error);
    }
  };

  const handleEventClick = async (clickInfo) => {
    try {
      const originalEvent = allEvents.find((e) => e._id === clickInfo.event.extendedProps._id);
      const res = await API.get(`api/v1/auth/groupName/${originalEvent._id}`);
      const newEvent = { ...originalEvent, groupName: res.data.name };
      setSelectedEvent(newEvent);
    } catch (err) {
      setError(error);
    }
  };

  const sendText = async () => {
    try {
      const config = { headers: { "Content-Type": "application/json" } };

      // get restaurant details
      const res = await API.post(
        "api/v1/auth/restaurantInfo",
        { location: selectedEvent.location, searchQuery: selectedEvent.restaurant },
        config
      );

      // get address
      const { display_address } = res.data[0].location;
      const address = display_address.join(", ");
      await API.post("api/v1/auth/sendText", { address: address }, config);
      alert("Address sent! Check your texts to find it.");
    } catch (err) {
      setError(error);
    }
  };

  const [open, setOpen] = useState(false);
  const closeModal = () => setOpen(false);

  return (
    <div className="events">
      <div className="profile-header">
        <h1>My events</h1>
        <div>
          <span
            className="button"
            onClick={() => setOpen((o) => !o)}
          >
            Create an invitation
          </span>
          <Popup
            open={open}
            closeOnDocumentClick
            onClose={closeModal}
            modal
            nested
          >
            <div className="event-popup">
              <InvitationForm
                groups={props.groups}
                startTime={startTime}
                setStartTime={setStartTime}
                availableTimes={availableTimes}
                setAvailableTimes={setAvailableTimes}
              />
              <img
                className="close"
                src={DeleteButton}
                onClick={closeModal}
                alt="delete button"
              />
            </div>
          </Popup>
        </div>
      </div>
      {/* Popup for creating an invitation */}

      <div className="calendar-container">
        <div className="calendar">
          <FullCalendar
            height="100%"
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={allEvents.map((event) => ({
              ...event,
              backgroundColor: "green",
            }))}
            eventClick={handleEventClick}
          />
        </div>
        {Object.keys(selectedEvent).length > 0 && (
          <div className="selected-event">
            <div className="header">
              <h2>{selectedEvent.title}</h2>
              <p>Hosted by {selectedEvent.groupName}</p>
            </div>

            <div className="divider" />

            <div className="section description">
              <h2 className="section-title">Description</h2>
              <p>{selectedEvent.description}</p>
            </div>

            <div className="divider" />

            <div className="section restaurant">
              <h2 className="section-title">Restaurant</h2>
              <h3>{selectedEvent.restaurant}</h3>
              <p onClick={sendText}>
                <img
                  src={map}
                  alt="map"
                />
                Text me the address
              </p>
            </div>

            <div className="divider" />

            <div className="section people">
              <h2 className="section-title">Group</h2>
              <h3>{selectedEvent.groupName}</h3>
              <Popup
                closeOnDocumentClick
                modal
                nested
                trigger={
                  <p>
                    <img
                      src={car}
                      alt="map"
                    />
                    View carpool details
                  </p>
                }
              >
                <DndProvider backend={HTML5Backend}>
                  <div
                    className="carpool-details"
                    style={{
                      backgroundColor: "white",
                      boxShadow: "rgba(149, 157, 165, 0.2) 0px 8px 24px",
                      padding: "0.5em",
                      borderRadius: "2em",
                      minWidth: "60%",
                      minHeight: "60%",
                    }}
                  >
                    <TaskBoard
                      eventId={selectedEvent._id}
                      currentUserId={props.currentUser._id}
                      passengers={passengers}
                    />
                  </div>
                </DndProvider>
              </Popup>
              <p>
                <img
                  src={people}
                  alt="map"
                />
                See who's coming
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Sections for created events */}
      <div>
        {/* only display nonfinalized events */}
        <h2>Pending events</h2>
        <h3>Hosted by me</h3>
        {hosted
          .filter((item) => !item.restaurant)
          .map((event, index) => (
            <InvitationCard
              currentUser={props.currentUser}
              guest={false}
              key={index}
              event={event}
            />
          ))}
        <h3>I was invited to</h3>
        {invitedTo
          .filter((item) => !item.restaurant)
          .map((event, index) => (
            <InvitationCard
              currentUser={props.currentUser}
              guest={true}
              key={index}
              event={event}
              groups={props.groups}
              availableTimes={availableTimes}
              setAvailableTimes={setAvailableTimes}
            />
          ))}
      </div>
    </div>
  );
}

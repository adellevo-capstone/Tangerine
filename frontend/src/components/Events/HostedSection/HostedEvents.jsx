import React, { useState, useEffect } from "react";
import InvitationCard from "../InvitationForm/InvitationCard";

export default function HostedEvents(props) {
  return (
    <div>
      <h2>Events I created</h2>
      {props.hosted.map((event, index) => (
        <InvitationCard
          guest={false}
          key={index}
          event={event}
        />
      ))}
    </div>
  );
}

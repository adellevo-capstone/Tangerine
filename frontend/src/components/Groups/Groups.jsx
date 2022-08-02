import React from "react";
import SearchPopup from "../Shared/components/SearchPopup/SearchPopup";
import nextButton from "../Shared/assets/NextButton.svg";
import { Link } from "react-router-dom";
import "../Groups/Groups.css";

export default function Groups(props) {
  return (
    <div className="group-section">
      <div className="group-section-header">
        <h1>My groups</h1>
        <SearchPopup
          itemsToAdd={props.usersToAdd}
          setItemsToAdd={props.setUsersToAdd}
          searchedItems={props.displayedUsers}
          setSearchQuery={props.setSearchQuery}
          setLocation={props.setLocation}
          findItem={props.findUsers}
          buttonText={"Create group"}
          typeToAdd={"Member"}
          actionType={"create"}
          groupId={props.groupId}
          loadAllGroups={props.loadAllGroups}
        />
      </div>
      <div className="groups-container">
        {props.groups.map((group, index) => (
          <div
            className="group"
            key={index}
          >
            <div className="label">
              <h2>{group.groupInfo.name}</h2>
              <p>{group.memberInfo.length} members</p>
            </div>
            <Link to={`${group.groupInfo.name}`}>
              <img
                src={nextButton}
                alt="next"
              />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

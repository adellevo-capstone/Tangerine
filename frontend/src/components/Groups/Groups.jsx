import React, { useState, useEffect } from "react";
import "../Groups/Groups.css";
import API from "../../utils/API";
import Popup from "reactjs-popup";
import GroupSearch from "./GroupSearch";

export default function Groups(props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState({});

  useEffect(() => {
    getCurrentUserInfo();
    props.loadAllGroups();
    loadAllUsers();
  }, []);

  const loadAllUsers = async () => {
    try {
      const res = await API.get("api/v1/auth/allUsers");
      setAllUsers(res.data);
    } catch (err) {
      console.log(err.response);
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const res = await API.get("api/v1/auth/user");
      setCurrentUser(res.data.user);
    } catch (err) {
      console.log(err.response);
    }
  };

  const leaveGroup = async (groupId) => {
    try {
      await API.patch(`api/v1/auth/group/${groupId}/leave`);
      props.loadAllGroups();
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="groups">
      <Popup
        modal
        nested
        trigger={<button> Create a group </button>}
        style={{
          minWidth: "40em",
        }}
      >
        <GroupSearch
          actionType={"createGroup"}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          location={location}
          setLocation={setLocation}
          loadAllUsers={loadAllUsers}
          allUsers={allUsers}
          groups={props.groups}
          loadAllGroups={props.loadAllGroups}
        />
      </Popup>
      <h2>My groups</h2>
      <div className="groups">
        {props.groups.map((group) => (
          <div className="group-content">
            <h3>{group.groupInfo.name}</h3>
            <p>{group.memberInfo.length} members</p>
            <ul>
              {group.memberInfo.map((member, index) => (
                <li key={index}>{member.firstName + " " + member.lastName}</li>
              ))}
            </ul>
            <Popup
              modal
              nested
              trigger={<button> Add a member </button>}
              style={{
                minWidth: "40em",
              }}
            >
              <GroupSearch
                actionType={"addMembers"}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                location={location}
                setLocation={setLocation}
                loadAllUsers={loadAllUsers}
                allUsers={allUsers}
                loadAllGroups={props.loadAllGroups}
                groupId={group.groupInfo._id}
                currentUser={currentUser}
              />
            </Popup>
            <button onClick={() => leaveGroup(group.groupInfo._id)}>Leave group</button>
          </div>
        ))}
      </div>
    </div>
  );
}

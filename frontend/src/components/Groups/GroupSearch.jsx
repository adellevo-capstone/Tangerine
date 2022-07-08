import React, { useState } from "react";
import axios from "axios";
import API from "../../utils/API";
import { useEffect } from "react";

export default function GroupSearch(props) {
  //   const [restaurant, setRestaurant] = useState("");
  const [usersToAdd, setUsersToAdd] = useState([]);
  const [displayedUsers, setDisplayedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    getCurrentUserInfo();
  }, []);

  const getCurrentUserInfo = async () => {
    try {
      const res = await API.get("api/v1/auth/user");
      console.log(res);
    } catch (err) {
      console.log(err.response);
    }
  };

  const findUsers = async () => {
    try {
      const filteredUsers = props.allUsers.filter(
        (user) =>
          user.firstName.toLowerCase().includes(props.searchQuery.toLowerCase()) ||
          user.lastName.toLowerCase().includes(props.searchQuery.toLowerCase())
      );
      setDisplayedUsers(filteredUsers);
    } catch (err) {
      console.log(err);
      console.log(err.message);
    }
  };

  const createGroup = async () => {
    try {
      const config = { headers: { "Content-Type": "application/json" } };
      const memberIds = usersToAdd.map((user) => {
        return user.userId;
      });
      const body = { name: groupName, members: memberIds };
      //   console.log(body);
      await API.patch("api/v1/auth/group/create", body, config);
      props.loadAllGroups();
    } catch (err) {
      console.log(err);
      console.log(err.message);
    }
  };

  return (
    <div className="search-popup">
      <h1>Search for a user to add</h1>
      <div className="search-popup-content">
        <input
          className="search"
          type="text"
          name="user"
          placeholder="Type in a name..."
          onChange={(e) => props.setSearchQuery(e.target.value)}
        />
        <button onClick={findUsers}>Search</button>
        <div>
          <h2>Search results:</h2>
          <ul>
            {displayedUsers.map((user, index) => (
              <li
                key={index}
                onClick={() =>
                  setUsersToAdd([
                    ...usersToAdd,
                    { name: user.firstName + " " + user.lastName, userId: user._id },
                  ])
                }
              >
                {user.firstName} {user.lastName}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Users to add:</h2>
          <ul>
            {usersToAdd.map((user, index) => (
              <li key={index}>{user.name}</li>
            ))}
          </ul>
          <input
            className="group name"
            type="text"
            name="user"
            placeholder="Pick a group name..."
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button onClick={createGroup}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

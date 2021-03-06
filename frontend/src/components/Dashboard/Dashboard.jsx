import React, { useState, useEffect } from "react";
import Profile from "../Profile/Profile";
import Navbar from "./Navbar";
import "../Shared/assets/Shared.css";
import "./assets/Dashboard.css";
import "../Profile/assets/Profile.css";
import UserSettings from "./UserSettings";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Event from "../Events/Event";
import Groups from "../Groups/Groups";
import API from "../../utils/API";

export default function Dashboard() {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    loadAllGroups();
  }, []);

  const loadAllGroups = async () => {
    try {
      const res = await API.get("api/v1/auth/group");
      setGroups(res.data.groups);
    } catch (err) {
      console.log(err.response);
    }
  };

  return (
    <div className="dashboard">
      <div className="actions">
        <Navbar />
        <UserSettings />
      </div>
      <Routes>
        <Route
          path="/profile"
          element={<Profile />}
        />
        <Route
          path="/events"
          element={
            <Event
              groups={groups}
              loadAllGroups={loadAllGroups}
            />
          }
        />
        <Route
          path="/groups"
          element={
            <Groups
              groups={groups}
              loadAllGroups={loadAllGroups}
            />
          }
        />
      </Routes>
    </div>
  );
}

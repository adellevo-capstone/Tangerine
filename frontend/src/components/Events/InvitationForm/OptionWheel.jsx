import React, { useState, useRef } from "react";
import API from "../../../utils/API";
import SpinningWheel, { SpinningWheelRef, WheelSegment } from "react-spinning-canvas-wheel";

export default function OptionWheel({ eventId }) {
  const spinningWheelRef = useRef();
  const [segments, setSegments] = useState([]);
  const [currentOption, setCurrentOption] = useState("");
  const [time, setTime] = useState("");

  const loadSpinnerOptions = async () => {
    const res = await API.get(`api/v1/auth/generateEventDetails/${eventId}`);
    const restaurantNames = res.data.options;
    const updatedSegments = restaurantNames.map((option) => {
      return { title: option.name };
    });

    setSegments(updatedSegments);
  };

  return (
    <div>
      <p>{currentOption}</p>
      <button onClick={() => spinningWheelRef.current.startSpinning(20, 2)}>Start</button>
      {/* <button onClick={() => spinningWheelRef.current.stopSpinning()}>Stop</button> */}
      <div className="spinning-wheel">
        <div className="triangle" />
        <div className="options">
          <SpinningWheel
            size={450}
            segments={segments}
            spinningWheelRef={spinningWheelRef}
            onSegmentChange={(index) => setCurrentOption(segments[index].title)}
            onSpinStart={() => console.log("started")}
            onSpinEnd={(winnerIndex) => console.log("winnerIndex:", winnerIndex)}
          />
        </div>
      </div>

      <button onClick={loadSpinnerOptions}>Get options</button>
    </div>
  );
}

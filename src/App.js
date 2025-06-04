import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import './App.css';

const App = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [angles, setAngles] = useState({});
  const [isDetecting, setIsDetecting] = useState(false);
  const [pushupNote, setPushupNote] = useState('');
  const [pushupReps, setPushupReps] = useState(0);
  const [pushupState, setPushupState] = useState('not_ready'); // 'not_ready', 'up', 'down'
  const [upFrameCount, setUpFrameCount] = useState(0); // for robust start
  const [exercise, setExercise] = useState('pushup'); // 'pushup', 'squat', 'plank'
  const [plankNote, setPlankNote] = useState('');

  // Initialize MediaPipe
  useEffect(() => {
    const initializePoseLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        
        setPoseLandmarker(landmarker);
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing pose landmarker:", error);
        setIsLoading(false);
      }
    };

    initializePoseLandmarker();
  }, []);

  // Calculate angle between three points
  const calculateAngle = useCallback((pointA, pointB, pointC) => {
    const radians = Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) - 
                   Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return Math.round(angle);
  }, []);

  // Draw landmarks and connections
  const drawLandmarks = useCallback((canvas, landmarks) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Mirror the canvas horizontally to match the mirrored webcam
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    
    if (!landmarks || landmarks.length === 0) {
      ctx.restore();
      return;
    }

    const pose = landmarks[0];
    
    /*
        MediaPipe Pose 33 Landmarks
        | Index | Name | Description |
        |-------|---------------------|------------------------------------|
        | 0 | nose | Nose tip |
        | 1 | left_eye_inner | Left eye inner corner |
        | 2 | left_eye | Left eye center |
        | 3 | left_eye_outer | Left eye outer corner |
        | 4 | right_eye_inner | Right eye inner corner |
        | 5 | right_eye | Right eye center |
        | 6 | right_eye_outer | Right eye outer corner |
        | 7 | left_ear | Left ear |
        | 8 | right_ear | Right ear |
        | 9 | mouth_left | Left mouth corner |
        | 10 | mouth_right | Right mouth corner |
        | 11 | left_shoulder | Left shoulder |
        | 12 | right_shoulder | Right shoulder |
        | 13 | left_elbow | Left elbow |
        | 14 | right_elbow | Right elbow |
        | 15 | left_wrist | Left wrist |
        | 16 | right_wrist | Right wrist |
        | 17 | left_pinky | Left pinky finger |
        | 18 | right_pinky | Right pinky finger |
        | 19 | left_index | Left index finger |
        | 20 | right_index | Right index finger |
        | 21 | left_thumb | Left thumb |
        | 22 | right_thumb | Right thumb |
        | 23 | left_hip | Left hip |
        | 24 | right_hip | Right hip |
        | 25 | left_knee | Left knee |
        | 26 | right_knee | Right knee |
        | 27 | left_ankle | Left ankle |
        | 28 | right_ankle | Right ankle |
        | 29 | left_heel | Left heel |
        | 30 | right_heel | Right heel |
        | 31 | left_foot_index | Left foot index (big toe) |
        | 32 | right_foot_index | Right foot index (big toe) |


        Example:
        The left arm is represented by the sequence: 11 (shoulder) → 13 (elbow) → 15 (wrist) → 17/19/21 (fingers)
        The right leg is: 24 (hip) → 26 (knee) → 28 (ankle) → 30/32 (foot)
    */
   
    // Draw connections
    const connections = [
      [11, 13], [13, 15], // Left arm
      [12, 14], [14, 16], // Right arm
      [11, 12], // Shoulders
      [23, 25], [25, 27], // Left leg
      [24, 26], [26, 28], // Right leg
      [23, 24], // Hips
      [11, 23], [12, 24] // Torso
    ];

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    
    connections.forEach(([start, end]) => {
      const startPoint = pose[start];
      const endPoint = pose[end];
      
      if (startPoint && endPoint && startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x * width, startPoint.y * height);
        ctx.lineTo(endPoint.x * width, endPoint.y * height);
        ctx.stroke();
      }
    });

    // Draw landmarks
    ctx.fillStyle = '#ff0000';
    pose.forEach((landmark, index) => {
      if (landmark.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Calculate and display angles
    const newAngles = {};
    
    // Helper function to check if points are valid
    const arePointsValid = (points) => {
      return points.every(point => point && point.visibility > 0.5);
    };
    
    // Left elbow angle
    if (arePointsValid([pose[11], pose[13], pose[15]])) {
      newAngles.leftElbow = calculateAngle(pose[11], pose[13], pose[15]);
    }
    
    // Right elbow angle
    if (arePointsValid([pose[12], pose[14], pose[16]])) {
      newAngles.rightElbow = calculateAngle(pose[12], pose[14], pose[16]);
    }
    
    // Left knee angle
    if (arePointsValid([pose[23], pose[25], pose[27]])) {
      newAngles.leftKnee = calculateAngle(pose[23], pose[25], pose[27]);
    }
    
    // Right knee angle
    if (arePointsValid([pose[24], pose[26], pose[28]])) {
      newAngles.rightKnee = calculateAngle(pose[24], pose[26], pose[28]);
    }

    // Left shoulder angle
    if (arePointsValid([pose[13], pose[11], pose[23]])) {
      newAngles.leftShoulder = calculateAngle(pose[13], pose[11], pose[23]);
    }

    // Right shoulder angle
    if (arePointsValid([pose[14], pose[12], pose[24]])) {
      newAngles.rightShoulder = calculateAngle(pose[14], pose[12], pose[24]);
    }

    // Only update state if we have valid angles
    if (Object.keys(newAngles).length > 0) {
      setAngles(prevAngles => ({
        ...prevAngles,
        ...newAngles
      }));
      // Switch technique/rep logic based on exercise
      if (exercise === 'pushup') {
        checkPushupTechnique(pose, { ...angles, ...newAngles });
      } else if (exercise === 'squat') {
        checkSquatTechnique(pose, { ...angles, ...newAngles });
      } else if (exercise === 'plank') {
        checkPlankTechnique(pose);
      }
    }

    // Draw angle labels with improved visibility
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    const drawAngleLabel = (x, y, angle, offsetX = 10, offsetY = -10) => {
      if (angle !== undefined) {
        const text = `${angle}°`;
        ctx.strokeText(text, x + offsetX, y + offsetY);
        ctx.fillText(text, x + offsetX, y + offsetY);
      }
    };
    
    // Draw all angle labels
    if (pose[13] && newAngles.leftElbow) {
      drawAngleLabel(pose[13].x * width, pose[13].y * height, newAngles.leftElbow);
    }
    
    if (pose[14] && newAngles.rightElbow) {
      drawAngleLabel(pose[14].x * width, pose[14].y * height, newAngles.rightElbow, -50);
    }
    
    if (pose[25] && newAngles.leftKnee) {
      drawAngleLabel(pose[25].x * width, pose[25].y * height, newAngles.leftKnee, 10, 0);
    }
    
    if (pose[26] && newAngles.rightKnee) {
      drawAngleLabel(pose[26].x * width, pose[26].y * height, newAngles.rightKnee, -50, 0);
    }

    ctx.restore();
  }, [calculateAngle, angles, exercise]);

  // Process video frame
  const detectPose = useCallback(async () => {
    if (
      poseLandmarker &&
      webcamRef.current &&
      webcamRef.current.video &&
      webcamRef.current.video.readyState === 4
    ) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        try {
          // Use performance.now() for more reliable timestamps
          const timestamp = Math.floor(performance.now());
          const result = await poseLandmarker.detectForVideo(video, timestamp);
          
          if (result.landmarks && result.landmarks.length > 0) {
            drawLandmarks(canvas, result.landmarks);
          } else {
            // Clear canvas if no landmarks detected
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        } catch (error) {
          console.error("Error detecting pose:", error);
          // Clear canvas on error
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [poseLandmarker, drawLandmarks]);

  // Animation loop
  useEffect(() => {
    let animationFrame;
    let isRunning = true;
    let lastTimestamp = 0;
    
    const animate = async () => {
      if (!isRunning) return;
      
      if (isDetecting && poseLandmarker) {
        const currentTime = performance.now();
        // Ensure minimum time between frames (30fps)
        if (currentTime - lastTimestamp >= 33) {
          await detectPose();
          lastTimestamp = currentTime;
        }
      }
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    if (isDetecting && poseLandmarker) {
      animate();
    }
    
    return () => {
      isRunning = false;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isDetecting, poseLandmarker, detectPose]);

  const toggleDetection = () => {
    setIsDetecting(!isDetecting);
  };

  // Utility: midpoint between two points
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  // Utility: distance between two points
  const distance = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  // Utility: alignment deviation (in degrees) between three points
  const alignmentDeviation = (p1, p2, p3) => {
    const slope1 = (p2.y - p1.y) / (p2.x - p1.x);
    const slope2 = (p3.y - p2.y) / (p3.x - p2.x);
    return Math.abs(Math.atan(slope2) - Math.atan(slope1)) * 180 / Math.PI;
  };

  // Helper function to check push-up technique and count reps
  const checkPushupTechnique = (pose, angles) => {
    // Key points
    const leftElbowAngle = angles.leftElbow;
    const rightElbowAngle = angles.rightElbow;
    const shoulder = midpoint(pose[11], pose[12]);
    const hip = midpoint(pose[23], pose[24]);
    const ankle = midpoint(pose[27], pose[28]);
    // Alignment: straight line head to heels
    const bodyAlign = alignmentDeviation(shoulder, hip, ankle);
    // Elbow angle at bottom (<90)
    let note = '';
    if (bodyAlign > 10) note += 'Keep body straight (no sag/sagging). ';
    if (leftElbowAngle > 100 && rightElbowAngle > 100) note += 'Go lower (elbows <90° at bottom). ';
    // Rep logic (as before, using leftElbowAngle)
    if (leftElbowAngle !== undefined) {
      if (pushupState === 'not_ready') {
        if (leftElbowAngle > 150) {
          setUpFrameCount(count => count + 1);
          if (upFrameCount + 1 >= 5) {
            setPushupState('up');
            setUpFrameCount(0);
          }
        } else {
          setUpFrameCount(0);
        }
      } else if (pushupState === 'up' && leftElbowAngle < 90) {
        setPushupState('down');
      } else if (pushupState === 'down' && leftElbowAngle > 150) {
        setPushupState('up');
        setPushupReps(reps => reps + 1);
      }
    }
    setPushupNote(note || 'Great push-up!');
  };

  // Helper function to check squat technique and count reps
  const [squatReps, setSquatReps] = useState(0);
  const [squatState, setSquatState] = useState('not_ready'); // 'not_ready', 'up', 'down'
  const [squatNote, setSquatNote] = useState('');
  const [squatUpFrameCount, setSquatUpFrameCount] = useState(0);
  const checkSquatTechnique = (pose, angles) => {
    // Key points
    const leftKneeX = pose[25]?.x, leftAnkleX = pose[27]?.x;
    const rightKneeX = pose[26]?.x, rightAnkleX = pose[28]?.x;
    const leftKneeAngle = angles.leftKnee;
    const rightKneeAngle = angles.rightKnee;
    const shoulder = midpoint(pose[11], pose[12]);
    const hip = midpoint(pose[23], pose[24]);
    const ankle = midpoint(pose[27], pose[28]);
    // Validation
    let note = '';
    // Knee alignment (knees track over toes)
    if (leftKneeX && leftAnkleX && Math.abs(leftKneeX - leftAnkleX) > 0.1) note += 'Keep knees over toes. ';
    if (rightKneeX && rightAnkleX && Math.abs(rightKneeX - rightAnkleX) > 0.1) note += 'Keep knees over toes. ';
    // Depth (knee angle 110-130)
    if (leftKneeAngle < 110 || rightKneeAngle < 110) note += 'Go deeper (hips below knees). ';
    if (leftKneeAngle > 130 || rightKneeAngle > 130) note += 'Squat deeper (knee angle too open). ';
    // Torso angle (shoulder-hip-ankle 40-50)
    const torsoAngle = calculateAngle(shoulder, hip, ankle);
    if (torsoAngle < 40 || torsoAngle > 55) note += 'Keep chest up, neutral spine. ';
    // Rep logic (as before)
    if (leftKneeAngle !== undefined) {
      if (squatState === 'not_ready') {
        if (leftKneeAngle > 160) {
          setSquatUpFrameCount(count => count + 1);
          if (squatUpFrameCount + 1 >= 5) {
            setSquatState('up');
            setSquatUpFrameCount(0);
          }
        } else {
          setSquatUpFrameCount(0);
        }
      } else if (squatState === 'up' && leftKneeAngle < 110) {
        setSquatState('down');
      } else if (squatState === 'down' && leftKneeAngle > 160) {
        setSquatState('up');
        setSquatReps(reps => reps + 1);
      }
    }
    setSquatNote(note || 'Good squat!');
  };

  // Helper function to check plank technique
  const checkPlankTechnique = (pose) => {
    // Key points
    const shoulder = midpoint(pose[11], pose[12]);
    const hip = midpoint(pose[23], pose[24]);
    const ankle = midpoint(pose[27], pose[28]);
    // Alignment: straight line from shoulders to ankles
    const bodyAlign = alignmentDeviation(shoulder, hip, ankle);
    // Hip/shoulder Y difference
    const shoulderY = shoulder.y;
    const hipY = hip.y;
    let note = '';
    if (bodyAlign > 10) note += 'Keep your body in a straight line. ';
    if (Math.abs(shoulderY - hipY) > 0.05) note += 'Don\'t let hips sag or pike. ';
    setPlankNote(note || 'Great plank!');
  };

  if (isLoading) {
    return (
      <div className="loading">
        <h2>Loading MediaPipe Model...</h2>
        <p>Please wait while we initialize the pose detection system.</p>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Movement Tracker POC</h1>
        <p>Real-time pose detection with angle measurements</p>
      </header>
      
      <div className="camera-container">
        <div className="video-wrapper" style={{ 
          position: 'relative',
          width: '100%',
          height: '80vh',
          overflow: 'hidden'
        }}>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            mirrored={true}
            style={{ 
              position: 'absolute',
              zIndex: 1,
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <canvas
            ref={canvasRef}
            style={{ 
              position: 'absolute',
              zIndex: 2,
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
        
        <div className="controls">
          <button onClick={toggleDetection} className="control-button">
            {isDetecting ? 'Stop Detection' : 'Start Detection'}
          </button>
          <select value={exercise} onChange={e => setExercise(e.target.value)} style={{ marginLeft: 20, padding: 10, borderRadius: 8, fontSize: 16 }}>
            <option value="pushup">Push-up</option>
            <option value="squat">Squat</option>
            <option value="plank">Plank</option>
          </select>
        </div>
        
        <div className="angles-display">
          <h3>Current Angles</h3>
          {exercise === 'pushup' && (
            <>
              <div style={{ marginTop: '20px', color: pushupNote.includes('Great') ? '#21aa6f' : '#ffb347', fontWeight: 'bold', fontSize: '1.2rem' }}>
                PUSH-UP NOTE: {pushupNote}
              </div>
              <div style={{ marginTop: '10px', color: '#61dafb', fontWeight: 'bold', fontSize: '1.5rem' }}>
                Push-up Reps: {pushupReps}
              </div>
            </>
          )}
          {exercise === 'squat' && (
            <>
              <div style={{ marginTop: '20px', color: squatNote.includes('Good') ? '#21aa6f' : '#ffb347', fontWeight: 'bold', fontSize: '1.2rem' }}>
                SQUAT NOTE: {squatNote}
              </div>
              <div style={{ marginTop: '10px', color: '#61dafb', fontWeight: 'bold', fontSize: '1.5rem' }}>
                Squat Reps: {squatReps}
              </div>
            </>
          )}
          {exercise === 'plank' && (
            <div style={{ marginTop: '20px', color: plankNote.includes('Great') ? '#21aa6f' : '#ffb347', fontWeight: 'bold', fontSize: '1.2rem' }}>
              PLANK NOTE: {plankNote}
            </div>
          )}
          <div className="angles-grid">
            {Object.entries(angles).map(([joint, angle]) => (
              <div key={joint} className="angle-item">
                <span className="joint-name">{joint.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="angle-value">{angle}°</span>
              </div>
            ))}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default App;

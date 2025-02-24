const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./firebaseConfig.json');

app.use(cors());
app.use(express.json());

const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

// Firebase initialization
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mymaps-e8396-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = admin.database();

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Configuration for traffic jam classification
let trafficJamConfig = {
  lightJam: { maxSpeed: 15, minDevices: 3 },
  moderateJam: { maxSpeed: 10, minDevices: 5 },
  severeJam: { maxSpeed: 5, minDevices: 7 },
  maxDistance: 0.03, // 30 meters (0.03 km)
  stationaryTime: 30 * 1000 // 30 seconds
};

// Hàm kiểm tra kết nối Firebase
function checkFirebaseConnection() {
  return new Promise((resolve, reject) => {
    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
      if (snap.val() === true) {
        console.log('Kết nối với Firebase thành công');
        resolve(true);
      } else {
        console.log('Mất kết nối với Firebase');
      }
    });
  });
}

// Hàm tính khoảng cách giữa hai điểm (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính Trái Đất trong km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Khoảng cách trong km
}

// Hàm chuyển đổi chuỗi timestamp thành milliseconds
function convertTimestampToMs(timestampStr) {
  const [datePart, timePart] = timestampStr.split(' ');
  const [day, month, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

// Hàm kiểm tra và phân loại tình trạng kẹt xe
function classifyTrafficJam(locations) {
  const groups = [];
  locations.forEach(loc => {
    let added = false;
    for (let group of groups) {
      if (getDistance(loc.latitude, loc.longitude, group[0].latitude, group[0].longitude) <= trafficJamConfig.maxDistance) {
        group.push(loc);
        added = true;
        break;
      }
    }
    if (!added) {
      groups.push([loc]);
    }
  });
  
  const trafficJams = groups.filter(group => {
    if (group.length < trafficJamConfig.lightJam.minDevices) return false;
    
    const avgSpeed = group.reduce((sum, loc) => sum + loc.avgSpeed, 0) / group.length;
    const timestamps = group.map(loc => convertTimestampToMs(loc.timestamp));
    const oldestTimestamp = Math.min(...timestamps);
    const newestTimestamp = Math.max(...timestamps);
    
    return avgSpeed <= trafficJamConfig.lightJam.maxSpeed && (newestTimestamp - oldestTimestamp) >= trafficJamConfig.stationaryTime;
  }).map(group => {
    const avgSpeed = group.reduce((sum, loc) => sum + loc.avgSpeed, 0) / group.length;
    const centerLat = group.reduce((sum, loc) => sum + loc.latitude, 0) / group.length;
    const centerLon = group.reduce((sum, loc) => sum + loc.longitude, 0) / group.length;
    
    let severity;
    if (avgSpeed <= trafficJamConfig.severeJam.maxSpeed && group.length >= trafficJamConfig.severeJam.minDevices) {
      severity = 'severe';
    } else if (avgSpeed <= trafficJamConfig.moderateJam.maxSpeed && group.length >= trafficJamConfig.moderateJam.minDevices) {
      severity = 'moderate';
    } else {
      severity = 'light';
    }
    
    return {
      severity,
      avgSpeed,
      deviceCount: group.length,
      latitude: centerLat,
      longitude: centerLon
    };
  });
  
  return trafficJams;
}

// Xử lý dữ liệu và kiểm tra kẹt xe
function processRealtimeTrafficData() {
  checkFirebaseConnection()
    .then(() => {
      const locationsRef = db.ref('locations');
      
      return locationsRef.once('value');
    })
    .then((snapshot) => {
      const locations = [];
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        locations.push({
          latitude: userData.latitude,
          longitude: userData.longitude,
          avgSpeed: userData.avgSpeed || 0,
          timestamp: userData.timestamp
        });
      });

      // Kiểm tra và phân loại kẹt xe
      const trafficJams = classifyTrafficJam(locations);
  
      if (trafficJams.length > 0) {
        console.log('Phát hiện kẹt xe tại các vị trí:');
        trafficJams.forEach((jam, index) => {
          console.log(`Khu vực ${index + 1}: ${jam.deviceCount} thiết bị, Tốc độ trung bình: ${jam.avgSpeed.toFixed(2)} km/h, Mức độ: ${jam.severity}`);
        });
        io.emit('trafficJam', trafficJams);
      } else {
        console.log('Không phát hiện kẹt xe');
      }
    })
    .catch((error) => {
      console.error("Lỗi khi xử lý dữ liệu:", error);
    });
}

// API endpoint để cập nhật cấu hình kẹt xe
app.post('/api/update-config', (req, res) => {
  const newConfig = req.body;
  if (newConfig && typeof newConfig === 'object') {
    trafficJamConfig = { ...trafficJamConfig, ...newConfig };
    res.json({ success: true, message: 'Configuration updated successfully' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid configuration data' });
  }
});

// Thiết lập kiểm tra mỗi phút
setInterval(() => {
  processRealtimeTrafficData();
}, 60000); // Kiểm tra lại mỗi phút

// Bắt đầu lắng nghe kết nối từ client qua Socket.io
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Khởi động server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // Kiểm tra kết nối Firebase khi khởi động server
  checkFirebaseConnection()
    .then(() => {
      console.log('Server đã sẵn sàng và kết nối với Firebase');
      // Chạy ngay lập tức một lần để xem kết quả
      processRealtimeTrafficData();
    })
    .catch((error) => {
      console.error('Không thể kết nối với Firebase:', error);
    });
});
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./firebaseConfig.json');
const axios = require('axios');
const recentLocations = new Map(); // Lưu trữ vị trí gần đây của mỗi thiết bị
let historicalData = [];
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

// Cấu hình kẹt xe động
let trafficJamConfig = {
  lightJam: { maxSpeed: 15, minDevices: 3 },
  moderateJam: { maxSpeed: 10, minDevices: 5 },
  severeJam: { maxSpeed: 5, minDevices: 7 },
  maxDistance: 0.015, // 15 meters (0.015 km)
  stationaryTime: 30 * 1000 // 30 seconds
};

const REPORT_VALIDITY_DURATION = 30 * 60 * 1000; // 30 phút
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 phút

let userReports = [];

// Hàm xử lý báo cáo từ người dùng
function handleUserReport(report) {
  userReports.push({
    message: report.message, // Thông điệp từ người dùng
    latitude: report.latitude, // Vĩ độ
    longitude: report.longitude, // Kinh độ
    timestamp: report.timestamp // Thời gian báo cáo
  });
  console.log('Báo cáo kẹt xe từ người dùng:', report);
}

// Hàm cập nhật cấu hình kẹt xe
let currentJamCount = 0; // Khai báo biến toàn cục để theo dõi số lượng kẹt xe hiện tại

function updateTrafficJamConfig() {
  const currentTime = Date.now();
  
  // Lọc báo cáo còn hiệu lực
  userReports = userReports.filter(report => currentTime - report.timestamp <= REPORT_VALIDITY_DURATION);

  // Đếm số lượng báo cáo cho mỗi mức độ
  const reportCounts = {
    light: 0,
    moderate: 0,
    severe: 0
  };

  userReports.forEach(report => {
    reportCounts[report.severity]++;
  });

  // Tính toán tổng số người dùng
  getTotalUsers().then(totalUsers => {
    // Tính toán ngưỡng cơ bản dựa trên số lượng người dùng
    const baseThreshold = Math.max(3, Math.floor(totalUsers * 0.01));
    
    // Điều chỉnh cấu hình dựa trên báo cáo người dùng
    const configAdjustment = (count, severity) => {
      const adjustmentFactor = {
        light: 1,
        moderate: 1.2,
        severe: 1.5
      };
      return Math.ceil(count * adjustmentFactor[severity] / 10);
    };

    // Cập nhật cấu hình kẹt xe
    trafficJamConfig = {
      lightJam: { 
        maxSpeed: 15, 
        minDevices: baseThreshold + configAdjustment(reportCounts.light, 'light')
      },
      moderateJam: { 
        maxSpeed: 10, 
        minDevices: Math.max(5, Math.floor(baseThreshold * 1.5)) + configAdjustment(reportCounts.moderate, 'moderate')
      },
      severeJam: { 
        maxSpeed: 5, 
        minDevices: Math.max(7, Math.floor(baseThreshold * 2)) + configAdjustment(reportCounts.severe, 'severe')
      },
      maxDistance: 0.03,
      stationaryTime: 30 * 1000
    };

    // Thêm dữ liệu lịch sử
    historicalData.push({
      timestamp: currentTime,
      config: { ...trafficJamConfig },
      jamCount: currentJamCount // Sử dụng biến toàn cục thay vì trafficJams.length
    });
    
    if (historicalData.length > 24) { // Giữ dữ liệu 24 giờ gần nhất
      historicalData.shift();
    }
    
    // Điều chỉnh cấu hình dựa trên dữ liệu lịch sử
    const recentJamCounts = historicalData.slice(-6).map(data => data.jamCount);
    const avgJamCount = recentJamCounts.reduce((sum, count) => sum + count, 0) / recentJamCounts.length;
    
    if (avgJamCount > 10) { // Nếu số lượng kẹt xe trung bình cao
      trafficJamConfig.lightJam.minDevices *= 1.1;
      trafficJamConfig.lightJam.maxSpeed *= 0.9;
    } else if (avgJamCount < 2) { // Nếu số lượng kẹt xe trung bình thấp
      trafficJamConfig.lightJam.minDevices *= 0.9;
      trafficJamConfig.lightJam.maxSpeed *= 1.1;
    }
    
    // Giới hạn các giá trị để tránh thay đổi quá mức
    trafficJamConfig.lightJam.minDevices = Math.max(2, Math.min(10, trafficJamConfig.lightJam.minDevices));
    trafficJamConfig.lightJam.maxSpeed = Math.max(10, Math.min(20, trafficJamConfig.lightJam.maxSpeed));
    
    // Điều chỉnh các mức độ kẹt xe khác dựa trên mức độ nhẹ
    trafficJamConfig.moderateJam.minDevices = Math.ceil(trafficJamConfig.lightJam.minDevices * 1.5);
    trafficJamConfig.moderateJam.maxSpeed = trafficJamConfig.lightJam.maxSpeed * 0.7;
    trafficJamConfig.severeJam.minDevices = Math.ceil(trafficJamConfig.lightJam.minDevices * 2);
    trafficJamConfig.severeJam.maxSpeed = trafficJamConfig.lightJam.maxSpeed * 0.4;

    console.log('Cấu hình kẹt xe đã được cập nhật:');
    console.log('Light Jam:', trafficJamConfig.lightJam);
    console.log('Moderate Jam:', trafficJamConfig.moderateJam);
    console.log('Severe Jam:', trafficJamConfig.severeJam);
    console.log('Max Distance:', trafficJamConfig.maxDistance);
    console.log('Stationary Time:', trafficJamConfig.stationaryTime);
    
    // Gửi cấu hình mới cho tất cả client
    io.emit('updatedTrafficConfig', trafficJamConfig);
  });
}
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

// Hàm lấy địa chỉ từ tọa độ
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function getAddressFromCoordinates(lat, lon) {
  try {
    await delay(1000); // Thêm 1 giây chờ giữa các yêu cầu
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
          format: 'json',
          lat: lat,
          lon: lon,
          zoom: 18,
          addressdetails: 1
      },
      headers: {
          'User-Agent': 'MyTrafficApp/1.0 (ttloc2001010@student.ctuet.edu.vn)' // Thay bằng thông tin của bạn
      }
  });
  return response.data.display_name;
  } catch (error) {
    console.error('Lỗi khi lấy địa chỉ:', error);
    return 'Không thể xác định địa chỉ';
  }
}

// Hàm kiểm tra và phân loại tình trạng kẹt xe
async function classifyTrafficJam(locations) {
  // Xác định giờ cao điểm và ngày trong tuần
  const currentHour = new Date().getHours();
  const currentDay = new Date().getDay();
  
  const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 16 && currentHour <= 18);
  const isWeekday = currentDay >= 1 && currentDay <= 5;
  
  // Điều chỉnh ngưỡng tốc độ và số lượng thiết bị trong giờ cao điểm
  const speedThresholdAdjustment = isRushHour && isWeekday ? 0.8 : 1;
  const deviceCountThresholdAdjustment = isRushHour && isWeekday ? 0.8 : 1;

  const groups = [];
  
  // Nhóm các thiết bị gần nhau
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
  
  // Phân tích các nhóm thiết bị
  const trafficJams = await Promise.all(groups.filter(group => {
    if (group.length < trafficJamConfig.lightJam.minDevices) return false;

    const avgSpeed = group.reduce((sum, loc) => sum + loc.avgSpeed, 0) / group.length;
    const timestamps = group.map(loc => convertTimestampToMs(loc.timestamp));
    const oldestTimestamp = Math.min(...timestamps);
    const newestTimestamp = Math.max(...timestamps);

    return avgSpeed <= trafficJamConfig.lightJam.maxSpeed * speedThresholdAdjustment &&
           (newestTimestamp - oldestTimestamp) >= trafficJamConfig.stationaryTime;
  }).map(async group => {
    const avgSpeed = group.reduce((sum, loc) => sum + loc.avgSpeed, 0) / group.length;
    const centerLat = group.reduce((sum, loc) => sum + loc.latitude, 0) / group.length;
    const centerLon = group.reduce((sum, loc) => sum + loc.longitude, 0) / group.length;
    
    let severity;
    if (avgSpeed <= trafficJamConfig.severeJam.maxSpeed * speedThresholdAdjustment &&
        group.length >= trafficJamConfig.severeJam.minDevices * deviceCountThresholdAdjustment) {
      severity = 'severe';
    } else if (avgSpeed <= trafficJamConfig.moderateJam.maxSpeed * speedThresholdAdjustment &&
               group.length >= trafficJamConfig.moderateJam.minDevices * deviceCountThresholdAdjustment) {
      severity = 'moderate';
    } else {
      severity = 'light';
    }

    const address = await getAddressFromCoordinates(centerLat, centerLon);
    const currentTime = new Date();

    return {
      severity,
      avgSpeed,
      deviceCount: group.length,
      latitude: centerLat,
      longitude: centerLon,
      address,
      timestamp: currentTime.toISOString(),
      date: currentTime.toLocaleDateString('vi-VN'),
      time: currentTime.toLocaleTimeString('vi-VN')
    };
  }));
  
  // Hợp nhất các báo cáo từ người dùng và tăng mức độ nghiêm trọng nếu cần
  const additionalTrafficJams = userReports.filter(report => {
    // Kiểm tra nếu không có thiết bị nào trong phạm vi của báo cáo
    return !trafficJams.some(jam => getDistance(jam.latitude, jam.longitude, report.latitude, report.longitude) <= trafficJamConfig.maxDistance);
  }).reduce((mergedReports, report) => {
    // Tìm báo cáo trùng lặp trong danh sách
    const existingReport = mergedReports.find(r => getDistance(r.latitude, r.longitude, report.latitude, report.longitude) <= trafficJamConfig.maxDistance);
    if (existingReport) {
      existingReport.deviceCount += 1; // Tăng số lượng thiết bị (hoặc báo cáo)
      existingReport.severity = increaseSeverity(existingReport.severity); // Tăng mức độ nghiêm trọng
    } else {
      mergedReports.push({
        severity: 'light', // Kẹt xe nhẹ dựa trên báo cáo từ người dùng
        avgSpeed: 0, // Không có dữ liệu tốc độ
        deviceCount: 1, // Chỉ có người dùng báo cáo
        latitude: report.latitude,
        longitude: report.longitude,
        address: 'Địa điểm báo cáo từ người dùng',
        timestamp: report.timestamp,
        date: new Date(report.timestamp).toLocaleDateString('vi-VN'),
        time: new Date(report.timestamp).toLocaleTimeString('vi-VN')
      });
    }
    return mergedReports;
  }, []);

  // Trả về cả dữ liệu từ thiết bị và báo cáo từ người dùng
  return [...trafficJams, ...additionalTrafficJams];
}

// Hàm tăng mức độ nghiêm trọng của kẹt xe
function increaseSeverity(severity) {
  switch (severity) {
    case 'light': return 'moderate';
    case 'moderate': return 'severe';
    default: return 'severe';
  }
}


// Bộ nhớ tạm để lưu thông tin vị trí đã lưu
const savedTrafficJams = new Map(); // Key là `latitude,longitude`, value là `severity`

// Hàm lưu thông tin kẹt xe vào Firebase
async function saveTrafficJamToFirebase(trafficJam) {
  const locationKey = `${trafficJam.latitude},${trafficJam.longitude}`;
  const previousSeverity = savedTrafficJams.get(locationKey);

  // Chỉ lưu nếu vị trí này chưa được lưu hoặc mức độ kẹt xe đã thay đổi
  if (!previousSeverity || previousSeverity !== trafficJam.severity) {
    // Lấy địa chỉ từ tọa độ
    const address = await getAddressFromCoordinates(trafficJam.latitude, trafficJam.longitude);
    trafficJam.address = address; // Thêm địa chỉ vào thông tin kẹt xe

    // Lưu vào Firebase
    const trafficJamsRef = db.ref('trafficJams');
    await trafficJamsRef.push(trafficJam);

    // Cập nhật bộ nhớ tạm với vị trí và mức độ kẹt xe hiện tại
    savedTrafficJams.set(locationKey, trafficJam.severity);

    console.log(`Lưu kẹt xe tại vị trí: ${trafficJam.latitude}, ${trafficJam.longitude}, địa chỉ: ${address}, mức độ: ${trafficJam.severity}`);
  } else {
    console.log(`Đã lưu kẹt xe tại vị trí này trước đó: ${trafficJam.latitude}, ${trafficJam.longitude}, mức độ: ${trafficJam.severity}`);
  }
}

// Xử lý dữ liệu và kiểm tra kẹt xe
async function processRealtimeTrafficData() {
  try {
    await checkFirebaseConnection(); // Kiểm tra kết nối Firebase
    const locationsRef = db.ref('locations');
    const snapshot = await locationsRef.once('value');
    
    let locations = [];
    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      locations.push({
        latitude: userData.latitude,
        longitude: userData.longitude,
        avgSpeed: userData.avgSpeed || 0,
        timestamp: userData.timestamp
      });
    });

    // Xử lý thông tin các thiết bị (tạo ID nếu cần)
    locations = locations.map(loc => {
      const deviceId = loc.deviceId || `${loc.latitude},${loc.longitude}`; // Tạo ID dựa trên tọa độ nếu không có deviceId
      const prevLoc = recentLocations.get(deviceId); // Lấy thông tin trước đó của thiết bị

      if (prevLoc) {
        const timeDiff = (convertTimestampToMs(loc.timestamp) - convertTimestampToMs(prevLoc.timestamp)) / 1000; // Đơn vị: giây
        const distance = getDistance(loc.latitude, loc.longitude, prevLoc.latitude, prevLoc.longitude);
        const speed = distance / (timeDiff / 3600); // km/h

        loc.calculatedSpeed = speed; // Tính tốc độ dựa trên khoảng cách và thời gian

        // Kiểm tra và lưu tốc độ vào recentLocations nếu có sự thay đổi
        if (loc.calculatedSpeed !== prevLoc.calculatedSpeed) {
          loc.hasMoved = true; // Đánh dấu rằng thiết bị đã di chuyển
        } else {
          loc.hasMoved = false; // Không có sự thay đổi về tốc độ
        }
      }

      recentLocations.set(deviceId, loc); // Cập nhật thông tin thiết bị vào recentLocations
      return loc;
    });

    // Sau khi xử lý vị trí, bạn có thể gọi hàm classifyTrafficJam() để phân tích kẹt xe
    const trafficJams = await classifyTrafficJam(locations);

    if (trafficJams.length > 0) {
      console.log('Phát hiện kẹt xe tại các vị trí:');
      for (const jam of trafficJams) {
        console.log(`Khu vực: ${jam.address}, ${jam.deviceCount} thiết bị, Tốc độ trung bình: ${jam.avgSpeed.toFixed(2)} km/h, Mức độ: ${jam.severity}`);
        console.log(`Thời gian: ${jam.date} ${jam.time}`);

        // Lưu thông tin kẹt xe vào Firebase nếu phát hiện
        await saveTrafficJamToFirebase(jam);
      }
      io.emit('trafficJam', trafficJams); // Gửi thông tin kẹt xe đến các client
    } else {
      console.log('Không phát hiện kẹt xe');
    }

  } catch (error) {
    console.error("Lỗi khi xử lý dữ liệu:", error);
  }
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

// Hàm lấy tổng số người dùng
async function getTotalUsers() {
  const usersRef = db.ref('locations');
  const snapshot = await usersRef.once('value');
  return snapshot.numChildren();
}

// Thiết lập kiểm tra mỗi phút
setInterval(() => {
  processRealtimeTrafficData();
}, 60000); // Kiểm tra lại mỗi phút

// Dọn dẹp bộ nhớ tạm sau một thời gian nhất định (ví dụ, mỗi 24 giờ)
setInterval(() => {
  savedTrafficJams.clear(); // Xóa bộ nhớ tạm
  console.log('Đã dọn dẹp bộ nhớ tạm của các vị trí kẹt xe');
}, 24 * 60 * 60 * 1000); // 24 giờ

// Cập nhật cấu hình kẹt xe định kỳ
setInterval(updateTrafficJamConfig, UPDATE_INTERVAL);

// Bắt đầu lắng nghe kết nối từ client qua Socket.io
io.on('connection', (socket) => {
  console.log('New client connected');
  // Lắng nghe sự kiện 'reportTraffic' từ frontend
  socket.on('reportTraffic', (data) => {
    console.log('Traffic report received:', data);
    handleUserReport(data);
    io.emit('trafficNotification', data); // gửi lại cho các client khác
  });
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Khởi động server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  
  // Kiểm tra kết nối Firebase khi khởi động server
  checkFirebaseConnection()
    .then(async () => {
      console.log('Server đã sẵn sàng và kết nối với Firebase');
      
      // Chạy ngay lập tức một lần để xem kết quả
      await processRealtimeTrafficData();
      
      // Thêm lệnh đếm và in ra số lượng người dùng khi khởi động
      const totalUsers = await getTotalUsers();
      console.log(`Số lượng người dùng hiện tại trong Firebase: ${totalUsers}`);
    })
    .catch((error) => {
      console.error('Không thể kết nối với Firebase:', error);
    });
});

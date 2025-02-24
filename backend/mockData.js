// mockData.js
function createMockData() {
  const baseLatitude = 10.0466185;
  const baseLongitude = 105.7676762;
  const mockData = [];

  // Tạo một nhóm xe bị kẹt nặng
  for (let i = 0; i < 8; i++) {
    mockData.push({
      latitude: baseLatitude + (Math.random() - 0.5) * 0.0002,
      longitude: baseLongitude + (Math.random() - 0.5) * 0.0002,
      avgSpeed: 1 + Math.random() * 3, // 1-4 km/h
      timestamp: `14/09/2024 ${10 + Math.floor(Math.random() * 5)}:${Math.floor(Math.random() * 60)}:${Math.floor(Math.random() * 60)}`
    });
  }

  // Tạo một nhóm xe bị kẹt vừa
  for (let i = 0; i < 6; i++) {
    mockData.push({
      latitude: baseLatitude + 0.005 + (Math.random() - 0.5) * 0.0002,
      longitude: baseLongitude + 0.005 + (Math.random() - 0.5) * 0.0002,
      avgSpeed: 6 + Math.random() * 4, // 6-10 km/h
      timestamp: `14/09/2024 ${10 + Math.floor(Math.random() * 5)}:${Math.floor(Math.random() * 60)}:${Math.floor(Math.random() * 60)}`
    });
  }

  // Tạo một nhóm xe bị kẹt nhẹ
  for (let i = 0; i < 4; i++) {
    mockData.push({
      latitude: baseLatitude - 0.005 + (Math.random() - 0.5) * 0.0002,
      longitude: baseLongitude - 0.005 + (Math.random() - 0.5) * 0.0002,
      avgSpeed: 11 + Math.random() * 4, // 11-15 km/h
      timestamp: `14/09/2024 ${10 + Math.floor(Math.random() * 5)}:${Math.floor(Math.random() * 60)}:${Math.floor(Math.random() * 60)}`
    });
  }

  // Tạo một số xe di chuyển bình thường
  for (let i = 0; i < 10; i++) {
    mockData.push({
      latitude: baseLatitude + (Math.random() - 0.5) * 0.01,
      longitude: baseLongitude + (Math.random() - 0.5) * 0.01,
      avgSpeed: 20 + Math.random() * 40, // 20-60 km/h
      timestamp: `14/09/2024 ${10 + Math.floor(Math.random() * 5)}:${Math.floor(Math.random() * 60)}:${Math.floor(Math.random() * 60)}`
    });
  }

  return mockData;
}

module.exports = createMockData;

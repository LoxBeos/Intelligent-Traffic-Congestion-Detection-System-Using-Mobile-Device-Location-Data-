// backend/services/notificationService.js
function sendNotification(analysis) {
    if (analysis.congestionDetected) {
      const { latitude, longitude } = analysis.congestionLocation;
      console.log(`Congestion detected at (${latitude}, ${longitude})`);
      
      // Logic để gửi thông báo đến người dùng
      // Ví dụ: sử dụng Firebase Cloud Messaging (FCM) hoặc bất kỳ dịch vụ thông báo nào khác
    }
  }
  
  module.exports = { sendNotification };
  
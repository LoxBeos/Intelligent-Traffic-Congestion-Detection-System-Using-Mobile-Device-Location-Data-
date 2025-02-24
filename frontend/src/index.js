// những thứ cần thiết
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-control-geocoder';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import io from 'socket.io-client'; // Thêm import cho socket.io-client

// Khởi tạo kết nối Socket.IO
const socket = io();
// Đường dẫn tới tệp icon.SVG tùy chỉnh
import customIconUrl from '/img/person-solid.svg';
import customIconUrl2 from '/img/gps.png';

var map = L.map('map',{zoomControl:false}).setView([10.0488833, 105.7683547], 17); // xóa zoomcontrol nếu muốn xài 2 nút zoom

// Thiết lập tile layer từ OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    minZoom: 5,
    maxZoom: 25,
}).addTo(map);

// Tạo biểu tượng tùy chỉnh từ tệp SVG
const customIcon = L.icon({
    iconUrl: customIconUrl,
    iconSize: [40, 40], // Kích thước icon (tuỳ chỉnh)
    iconAnchor: [20, 40], // Điểm neo (giữa đáy icon)
    popupAnchor: [0, -40] // Vị trí của popup tương ứng với icon
});

const customGPS = L.icon({
    iconUrl: customIconUrl2,
    iconSize: [40, 40], // Kích thước icon (tuỳ chỉnh)
    iconAnchor: [20, 40], // Điểm neo (giữa đáy icon)
    popupAnchor: [0, -40] // Vị trí của popup tương ứng với icon
});

let userMarker = null;
let searchMarker = null;
let routingControl = null;
// Biến để lưu trữ các marker kẹt xe
let trafficJamMarkers = [];
let markers = []; // Mảng chứa các marker

// Hàm lấy vị trí hiện tại của người dùng và đặt marker
function updatePosition(centerMap = true) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                // Đặt lại marker người dùng
                if (userMarker) {
                    map.removeLayer(userMarker);
                }

                userMarker = L.marker([lat, lon], { icon: customIcon }).addTo(map)
                    .bindPopup(`Bạn đang ở đây!`)
                    .openPopup();

                // Chỉ đặt lại vị trí trung tâm của bản đồ khi centerMap là true
                if (centerMap) {
                    map.setView([lat, lon], 18);
                }

                console.log(`Cập nhật vị trí: Latitude ${lat}, Longitude ${lon}`);
            },
            function (error) {
                console.error("Lỗi lấy vị trí người dùng | Mã lỗi:", error.message);
            }
        );
    } else {
        alert("Trình duyệt của bạn không hỗ trợ Geolocation.");
    }
}

// Gọi hàm mỗi 10 giây để cập nhật vị trí người dùng
setInterval(() => updatePosition(false), 10000); // Cập nhật vị trí mỗi 10 giây nhưng không thay đổi trung tâm bản đồ

// Gọi hàm ban đầu với centerMap = true để đặt trung tâm khi ứng dụng khởi động
updatePosition(true);

// Gán sự kiện click cho nút "Tìm vị trí"
document.getElementById('trackButton').addEventListener('click', function () {
    if (userMarker) {
        map.removeLayer(userMarker); // Xóa marker cũ nếu tồn tại
        userMarker = null;
    }
    updatePosition(true); // Cập nhật vị trí và đặt trung tâm bản đồ

    // Xóa marker tìm kiếm nếu tồn tại
    if (searchMarker) {
        map.removeLayer(searchMarker);
        searchMarker = null;
    }
});
// Gán sự kiện click cho nút "Hiển thị điều hướng"
document.getElementById('routingButton').addEventListener('click', function () {
    if (routingControl) {
        map.removeControl(routingControl); // Ẩn điều hướng nếu nó đang hiển thị
        routingControl = null;
    } else {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                const currentLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
                routingControl = L.Routing.control({
                    waypoints: [
                        currentLatLng, // Vị trí hiện tại của người dùng
                    ],
                    routeWhileDragging: true,
                    geocoder: L.Control.Geocoder.nominatim(),
                    createMarker: function(i, waypoint, n) {
                        return L.marker(waypoint.latLng, {
                            icon: customGPS // Sử dụng biểu tượng tùy chỉnh
                        });
                    }
                }).addTo(map);
            }.bind(this), function (error) {
                console.error("Lỗi lấy vị trí người dùng | Mã lỗi:", error);
                alert("Không thể lấy vị trí hiện tại của bạn. Vui lòng kiểm tra cài đặt vị trí của bạn.");
            });
        } else {
            alert("Trình duyệt của bạn không hỗ trợ Geolocation.");
        }
    }
});


// Thêm thanh tìm kiếm vào bản đồ
const provider = new OpenStreetMapProvider();

const searchControl = new GeoSearchControl({
    provider: provider,
    style: 'bar',
    animateZoom: true,
    keepResult: true,
    autoComplete: true,
    autoCompleteDelay: 250,
    showMarker: false, // Không tự động hiển thị marker, sẽ tự quản lý marker
    updateMap: true, // Tự động cập nhật vị trí bản đồ khi tìm kiếm
    keepResult: true, // Giữ kết quả tìm kiếm
    searchLabel: 'Bạn đang tìm kiếm gì?...',
});

map.addControl(searchControl);

// Lắng nghe sự kiện kết quả tìm kiếm
map.on('geosearch/showlocation', function (event) {
    // Kiểm tra tọa độ hợp lệ
    if (event.location && event.location.x && event.location.y) {
        // Chuyển đổi x, y thành lat, lng
        const latlng = {
            lat: event.location.y,
            lng: event.location.x
        };

        // Xóa marker tìm kiếm hiện tại nếu tồn tại
        if (searchMarker) {
            map.removeLayer(searchMarker);
        }

        // Thêm marker mới cho vị trí tìm kiếm
        searchMarker = L.marker(latlng, { icon: customGPS }).addTo(map)
            .bindPopup(event.location.label)
            .openPopup();
    } else {
        console.error("Invalid search location data:", event.location);
    }
});
//////////////////////////////////////////////////////

// Hàm để thêm marker tại vị trí kẹt xe
function addTrafficJamMarkers(trafficJams) {
    trafficJamMarkers.forEach(marker => map.removeLayer(marker));
    trafficJamMarkers = [];

    trafficJams.forEach(jam => {
        const markerColor = jam.severity === 'severe' ? 'red' : (jam.severity === 'moderate' ? 'orange' : 'yellow');
        const marker = L.circleMarker([jam.latitude, jam.longitude], {
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.8,
            radius: 10
        }).addTo(map);

        marker.bindPopup(`Mức độ: ${jam.severity}<br>Tốc độ TB: ${jam.avgSpeed.toFixed(2)} km/h<br>Số thiết bị: ${jam.deviceCount}`);
        trafficJamMarkers.push(marker);
    });
}

// Lắng nghe sự kiện kết nối thành công
socket.on('connect', () => {
    console.log('BE đã kết nối');
  });

// Lắng nghe sự kiện ngắt kết nối
socket.on('disconnect', () => {
    console.log('BE đã ngắt kết nối');
  });
// Lắng nghe sự kiện 'trafficJam' từ server
socket.on('trafficJam', (trafficJams) => {
    console.log('Nhận dữ liệu kẹt xe:', trafficJams);
    addTrafficJamMarkers(trafficJams);
});

socket.on('connect_error', (error) => {
    console.error('Lỗi kết nối Socket.IO:', error);
});
    // Xóa các marker cũ trước khi thêm mới để tránh chồng lặp
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
  
  
//////////////////////////////////////////////////////////////////
// darkmode
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const icon = themeToggle.querySelector('i');
themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-theme');
    if (body.classList.contains('dark-theme')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        localStorage.setItem('theme', 'light');
    }
});
// Example function to update the layout
function updateLayout() {
    const geoSearchControlContainer = document.querySelector('.leaflet-control-geosearch');
    const routingContainer = document.querySelector('.leaflet-routing-container');

    if (geoSearchControlContainer && routingContainer) {
        // Check if routing container is visible
        const routingVisible = routingContainer.style.display !== 'none';

        if (routingVisible) {
            geoSearchControlContainer.style.width = 'calc(100% - 20px)'; // Adjust width if routing is visible
        } else {
            geoSearchControlContainer.style.width = 'auto'; // Reset width if routing is not visible
        }
    }
}
//hàm người dùng báo cáo 
const reportButton = document.getElementById('reportButton');
reportButton.addEventListener('click', () => {
    if (navigator.geolocation) {
        // Lấy vị trí hiện tại của người dùng
        navigator.geolocation.getCurrentPosition(position => {
            const reportData = {
                message: 'Traffic jam reported!',
                latitude: position.coords.latitude,  // Lấy tọa độ vĩ độ
                longitude: position.coords.longitude,  // Lấy tọa độ kinh độ
                timestamp: new Date().toISOString()    // Thời gian báo cáo
            };
            // Gửi dữ liệu báo cáo kẹt xe đến backend
            socket.emit('reportTraffic', reportData);
        }, error => {
            console.error("Lỗi khi lấy vị trí:", error);
        });
    } else {
        console.error("Trình duyệt không hỗ trợ geolocation");
    }
});

// Lắng nghe thông báo người dùng từ backend
socket.on('trafficNotification', (data) => {
    console.log('Notification from server:', data);
});
//cấu hình kẹt xe
socket.on('updatedTrafficConfig', (newConfig) => {
    console.log('cấu hình kẹt xe đã được cập nhật:', newConfig);
});
// Event listener for routing state changes
map.on('routing:start', updateLayout);
map.on('routing:end', updateLayout);

// Initial layout update
updateLayout();

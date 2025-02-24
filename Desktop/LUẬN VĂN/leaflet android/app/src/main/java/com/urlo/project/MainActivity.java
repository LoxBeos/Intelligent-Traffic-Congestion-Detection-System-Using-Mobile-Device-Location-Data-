package com.urlo.project;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.os.Looper;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.viewpager2.widget.ViewPager2;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.material.tabs.TabLayout;
import com.google.android.material.tabs.TabLayoutMediator;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.messaging.FirebaseMessaging;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    // Constants
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1;
    private static final String PREF_UNIQUE_ID = "PREF_UNIQUE_ID";
    private static final String TAG = "MainActivity";
    private static final int SPEED_QUEUE_SIZE = 5;
    private static final long SPEED_UPDATE_INTERVAL = 8000; // 8 seconds
    private static final long AVG_SPEED_INTERVAL = 60000; // 1 minute

    // UI Components
    private ViewPager2 viewPager;
    private TabLayout tabLayout;

    // Location
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Location lastLocation;
    private long lastTime;

    // Data
    private String userId;
    private DatabaseReference databaseReference;
    private final Queue<Double> speedQueue = new ConcurrentLinkedQueue<>();

    // Executors
    private final Executor executor = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initializeUI();
        setupLocation();
        initializeFirebase();
        startDataUpdates();
    }

    private void initializeUI() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setupTabs();
        disableViewPagerSwipe();
    }

    private void setupTabs() {
        viewPager = findViewById(R.id.viewPager);
        tabLayout = findViewById(R.id.tabLayout);
        viewPager.setUserInputEnabled(false);
        ViewPagerAdapter adapter = new ViewPagerAdapter(this);
        viewPager.setAdapter(adapter);

        new TabLayoutMediator(tabLayout, viewPager, (tab, position) -> {
            tab.setText(position == 0 ? "Bản đồ" : "Thông báo");
        }).attach();

        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                viewPager.setCurrentItem(tab.getPosition());
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {}

            @Override
            public void onTabReselected(TabLayout.Tab tab) {}
        });
    }

    private void disableViewPagerSwipe() {
        viewPager.setUserInputEnabled(false);
    }

    private void setupLocation() {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult != null) {
                    processLocation(locationResult.getLastLocation());
                }
            }
        };

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, LOCATION_PERMISSION_REQUEST_CODE);
        } else {
            startLocationUpdates();
        }
    }

    private void initializeFirebase() {
        userId = getUserId(this);
        databaseReference = FirebaseDatabase.getInstance().getReference("locations");
    }

    private void startDataUpdates() {
        scheduler.scheduleAtFixedRate(() -> {
            if (lastLocation != null) {
                double avgSpeed = calculateAvgSpeed();
                sendDataToFirebase(
                        lastLocation.getLatitude(),
                        lastLocation.getLongitude(),
                        getCurrentSpeed(),
                        avgSpeed
                );
            }
        }, 0, SPEED_UPDATE_INTERVAL, TimeUnit.MILLISECONDS);
    }


    private void processLocation(Location currentLocation) {
        long currentTime = System.currentTimeMillis();

        if (lastLocation != null && lastTime != 0) {
            double distance = haversine(lastLocation.getLatitude(), lastLocation.getLongitude(),
                    currentLocation.getLatitude(), currentLocation.getLongitude());
            long timeDiff = currentTime - lastTime;

            double speedKmh = (distance / timeDiff) * 3600;

            if (distance > 0.001) { // Chỉ cập nhật nếu di chuyển ít nhất 10 mét
                String formattedSpeedString = String.format(Locale.getDefault(), "%.1f", speedKmh);
                formattedSpeedString = formattedSpeedString.replace(",", ".");
                double formattedSpeed = Double.parseDouble(formattedSpeedString);

                updateSpeedQueue(formattedSpeed);
                sendDataToFirebase(lastLocation.getLatitude(), lastLocation.getLongitude(), formattedSpeed, calculateAvgSpeed());
            }
        } else {
            sendDataToFirebase(currentLocation.getLatitude(), currentLocation.getLongitude(), 0, 0);
        }

        lastLocation = currentLocation;
        lastTime = currentTime;
    }


    private void updateSpeedQueue(double speed) {
        speedQueue.offer(speed);
        if (speedQueue.size() > SPEED_QUEUE_SIZE) {
            speedQueue.poll();
        }
    }

    private void startLocationUpdates() {
        LocationRequest locationRequest = LocationRequest.create()
                .setInterval(6000) // 6 giây
                .setFastestInterval(3000) // 3 giây
                .setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
    }

    private void startSpeedUpdates() {
        scheduler.scheduleAtFixedRate(() -> {
            if (lastLocation != null) {
                sendDataToFirebase(lastLocation.getLatitude(), lastLocation.getLongitude(), getCurrentSpeed(), calculateAvgSpeed());
            }
        }, 0, SPEED_UPDATE_INTERVAL, TimeUnit.MILLISECONDS);
    }

    private void startAvgSpeedScheduler() {
        scheduler.scheduleAtFixedRate(() -> {
            double avgSpeed = calculateAvgSpeed();
            sendDataToFirebase(lastLocation != null ? lastLocation.getLatitude() : 0,
                    lastLocation != null ? lastLocation.getLongitude() : 0,
                    0, avgSpeed);
        }, 0, AVG_SPEED_INTERVAL, TimeUnit.MILLISECONDS);
    }

    private double calculateAvgSpeed() {
        double sum = 0;
        int count = 0;
        for (Double speed : speedQueue) {
            sum += speed;
            count++;
        }
        return count > 0 ? sum / count : 0;
    }

    private double getCurrentSpeed() {
        return speedQueue.isEmpty() ? 0 : speedQueue.peek();
    }

    private void sendDataToFirebase(final double latitude, final double longitude, final double speed, final double avgSpeed) {
        executor.execute(() -> {
            try {
                DatabaseReference userLocationRef = databaseReference.child(userId);
                String currentTime = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault()).format(new Date());
                userLocationRef.child("latitude").setValue(latitude);
                userLocationRef.child("longitude").setValue(longitude);
                userLocationRef.child("speed").setValue(speed);
                userLocationRef.child("avgSpeed").setValue(avgSpeed);
                userLocationRef.child("timestamp").setValue(currentTime);
            } catch (Exception e) {
                Log.e(TAG, "Lỗi khi gửi dữ liệu lên Firebase", e);
            }
        });
    }

    private static String getUserId(Context context) {
        SharedPreferences sharedPrefs = context.getSharedPreferences(PREF_UNIQUE_ID, Context.MODE_PRIVATE);
        String userId = sharedPrefs.getString(PREF_UNIQUE_ID, null);
        if (userId == null) {
            userId = "User_" + UUID.randomUUID().toString();
            SharedPreferences.Editor editor = sharedPrefs.edit();
            editor.putString(PREF_UNIQUE_ID, userId);
            editor.apply();
        }
        return userId;
    }

    private static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        lat1 = Math.toRadians(lat1);
        lat2 = Math.toRadians(lat2);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371 * c;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startLocationUpdates();
            } else {
                // Kiểm tra nếu quyền bị từ chối vĩnh viễn
                if (!ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.ACCESS_FINE_LOCATION)) {
                    Toast.makeText(this, "Quyền vị trí bị từ chối vĩnh viễn. Hãy bật quyền trong cài đặt.", Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(this, "Quyền vị trí bị từ chối. Ứng dụng không thể hoạt động.", Toast.LENGTH_SHORT).show();
                }
            }
        }
    }


    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (scheduler != null) {
            scheduler.shutdown();
        }
    }
}
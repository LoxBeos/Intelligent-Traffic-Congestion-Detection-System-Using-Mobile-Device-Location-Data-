package com.urlo.project;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class NotificationsFragment extends Fragment {

    private RecyclerView recyclerView;
    private NotificationsAdapter notificationsAdapter;
    private List<Notification> notificationsList;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View rootView = inflater.inflate(R.layout.fragment_notifications, container, false);

        initializeRecyclerView(rootView);
        loadNotificationsFromFirebase();

        return rootView;
    }

    private void initializeRecyclerView(View rootView) {
        recyclerView = rootView.findViewById(R.id.recyclerView);
        recyclerView.setLayoutManager(new LinearLayoutManager(getContext()));
        notificationsList = new ArrayList<>();
        notificationsAdapter = new NotificationsAdapter(notificationsList);
        recyclerView.setAdapter(notificationsAdapter);
    }

    private void loadNotificationsFromFirebase() {
        DatabaseReference databaseRef = FirebaseDatabase.getInstance().getReference("trafficJams");

        databaseRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                notificationsList.clear();

                for (DataSnapshot trafficJamSnapshot : dataSnapshot.getChildren()) {
                    try {
                        String id = trafficJamSnapshot.getKey();

                        // Đọc và chuyển đổi dữ liệu an toàn
                        String address = getStringValue(trafficJamSnapshot, "address");
                        double avgSpeed = getDoubleValue(trafficJamSnapshot, "avgSpeed");
                        String date = getStringValue(trafficJamSnapshot, "date");
                        int deviceCount = getIntValue(trafficJamSnapshot, "deviceCount");
                        double latitude = getDoubleValue(trafficJamSnapshot, "latitude");
                        double longitude = getDoubleValue(trafficJamSnapshot, "longitude");
                        String severity = getStringValue(trafficJamSnapshot, "severity");
                        String time = getStringValue(trafficJamSnapshot, "time");
                        long timestamp = getLongValue(trafficJamSnapshot, "timestamp");

                        Notification notification = new Notification(
                                id, address, avgSpeed, date, deviceCount,
                                latitude, longitude, severity, time, timestamp
                        );

                        notificationsList.add(notification);

                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                Collections.sort(notificationsList, new Comparator<Notification>() {
                    @Override
                    public int compare(Notification n1, Notification n2) {
                        return Long.compare(n2.getTimestamp(), n1.getTimestamp());
                    }
                });

                notificationsAdapter.notifyDataSetChanged();
            }

            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                if(getContext() != null) {
                    Toast.makeText(getContext(),
                            "Error: " + databaseError.getMessage(),
                            Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    // Helper methods để chuyển đổi dữ liệu an toàn
    private String getStringValue(DataSnapshot snapshot, String key) {
        Object value = snapshot.child(key).getValue();
        return value != null ? value.toString() : "";
    }

    private double getDoubleValue(DataSnapshot snapshot, String key) {
        Object value = snapshot.child(key).getValue();
        if (value == null) return 0.0;
        try {
            if (value instanceof Long) {
                return ((Long) value).doubleValue();
            } else if (value instanceof Double) {
                return (Double) value;
            } else if (value instanceof String) {
                return Double.parseDouble((String) value);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return 0.0;
    }

    private int getIntValue(DataSnapshot snapshot, String key) {
        Object value = snapshot.child(key).getValue();
        if (value == null) return 0;
        try {
            if (value instanceof Long) {
                return ((Long) value).intValue();
            } else if (value instanceof Integer) {
                return (Integer) value;
            } else if (value instanceof String) {
                return Integer.parseInt((String) value);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return 0;
    }

    private long getLongValue(DataSnapshot snapshot, String key) {
        Object value = snapshot.child(key).getValue();
        if (value == null) return 0L;
        try {
            if (value instanceof Long) {
                return (Long) value;
            } else if (value instanceof Integer) {
                return ((Integer) value).longValue();
            } else if (value instanceof String) {
                return Long.parseLong((String) value);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return 0L;
    }

    // Helper method để lấy giá trị từ DataSnapshot với giá trị mặc định
    private <T> T getValue(DataSnapshot snapshot, String key, Class<T> type) {
        return getValue(snapshot, key, type, null);
    }

    private <T> T getValue(DataSnapshot snapshot, String key, Class<T> type, T defaultValue) {
        T value = snapshot.child(key).getValue(type);
        return value != null ? value : defaultValue;
    }

}
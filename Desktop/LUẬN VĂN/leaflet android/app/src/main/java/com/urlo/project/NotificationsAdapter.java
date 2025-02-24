package com.urlo.project;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class NotificationsAdapter extends RecyclerView.Adapter<NotificationsAdapter.ViewHolder> {
    public List<Notification> notifications;

    public NotificationsAdapter(List<Notification> notifications) {
        this.notifications = notifications;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.notification_item, parent, false);
        return new ViewHolder(view);
    }


    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Notification notification = notifications.get(position);

        holder.addressView.setText(notification.getAddress());
        holder.avgSpeedView.setText(notification.getAvgSpeed() + " km/h");
        holder.dateView.setText(notification.getDate());
        holder.deviceCountView.setText(String.valueOf(notification.getDeviceCount()));
        holder.severityView.setText(notification.getSeverity());
        holder.timeView.setText(notification.getTime());
        holder.timestampView.setText(String.valueOf(notification.getTimestamp()));
    }



    @Override
    public int getItemCount() {
        return notifications.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView addressView, avgSpeedView, dateView, deviceCountView, severityView, timeView, timestampView;

        ViewHolder(View itemView) {
            super(itemView);
            addressView = itemView.findViewById(R.id.textAddress);
            avgSpeedView = itemView.findViewById(R.id.textAvgSpeed);
            dateView = itemView.findViewById(R.id.textDate);
            deviceCountView = itemView.findViewById(R.id.textDeviceCount);
            severityView = itemView.findViewById(R.id.textSeverity);
            timeView = itemView.findViewById(R.id.textTime);
            timestampView = itemView.findViewById(R.id.textTimestamp);
        }
    }

}
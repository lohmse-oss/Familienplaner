package de.familie.planer;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Hintergrund-Abgleich: Fragt regelmäßig (alle ca. 15 Minuten) beim Server nach Änderungen und meldet,
 * wenn der Partner etwas eingetragen hat. Die Texte kommen fertig vom Server (_text/_verb).
 */
public final class PartnerSync {
    public static final String PREFS = "familienplaner_sync";
    public static final String CHANNEL = "partner";
    private static final String WORK_NAME = "partner-sync";

    private PartnerSync() {}

    public static void schedule(Context ctx) {
        Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(PartnerSyncWorker.class, 15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    /** Änderungen seit {@code since} holen (POST /api/sync ohne eigene Einträge). */
    public static JSONObject fetch(String server, String code, long since) throws IOException {
        HttpURLConnection c = null;
        try {
            URL url = new URL(server.replaceAll("/+$", "") + "/api/sync");
            c = (HttpURLConnection) url.openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            c.setDoOutput(true);
            c.setRequestProperty("content-type", "application/json");
            c.setRequestProperty("x-family-code", code);
            byte[] body = ("{\"since\":" + since + ",\"items\":[]}").getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = c.getOutputStream()) {
                out.write(body);
            }
            int status = c.getResponseCode();
            if (status == 401) throw new SecurityException("Familiencode falsch");
            if (status != 200) throw new IOException("HTTP " + status);
            StringBuilder sb = new StringBuilder();
            try (InputStream in = c.getInputStream(); BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
            }
            return new JSONObject(sb.toString());
        } catch (org.json.JSONException e) {
            throw new IOException(e);
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String nameOf(String id) {
        switch (id) {
            case "sebastian": return "Sebastian";
            case "betty": return "Betty";
            case "ida": return "Ida";
            case "irma": return "Irma";
            default: return id;
        }
    }

    private static String verbOf(String v) {
        if ("del".equals(v)) return "hat gelöscht";
        if ("edit".equals(v)) return "hat geändert";
        return "hat eingetragen";
    }

    /** Neue Einträge des Partners aus der Antwort herausfiltern (nicht von mir, mit Beschreibung). */
    public static List<JSONObject> partnerChanges(JSONArray items, String me) throws org.json.JSONException {
        List<JSONObject> out = new ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.getJSONObject(i);
            String by = it.optString("by", "");
            String text = it.optString("_text", "");
            if (by.length() > 0 && !by.equals(me) && text.length() > 0) out.add(it);
        }
        return out;
    }

    public static void notifyChanges(Context ctx, List<JSONObject> changes) {
        if (changes.isEmpty()) return;
        if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Änderungen vom Partner", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Hinweis, wenn Betty oder Sebastian etwas im Familienplaner einträgt");
            ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }

        String by = changes.get(0).optString("by", "");
        String title;
        if (changes.size() == 1) title = nameOf(by) + " " + verbOf(changes.get(0).optString("_verb", "new"));
        else title = nameOf(by) + ": " + changes.size() + " Änderungen";

        NotificationCompat.InboxStyle inbox = new NotificationCompat.InboxStyle().setBigContentTitle(title);
        int shown = Math.min(changes.size(), 4);
        for (int i = 0; i < shown; i++) inbox.addLine(changes.get(i).optString("_text", ""));
        if (changes.size() > shown) inbox.setSummaryText("… und " + (changes.size() - shown) + " weitere");

        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_family)
            .setContentTitle(title)
            .setContentText(changes.get(0).optString("_text", ""))
            .setStyle(inbox)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(ctx).notify((int) (System.currentTimeMillis() / 1000L), b.build());
        } catch (SecurityException ignored) {
            // Berechtigung fehlt – kein Hinweis möglich
        }
    }
}

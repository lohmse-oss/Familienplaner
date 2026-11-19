package de.familie.planer;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.media.MediaDescription;
import android.media.MediaMetadata;
import android.media.browse.MediaBrowser;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.os.Process;
import android.service.media.MediaBrowserService;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Android Auto: Familienplaner als Medien-App im Auto-Launcher.
 *
 * Warum Medien-App? Android Auto zeigt per Sideload installierte Apps nur dann im Launcher
 * („Launcher anpassen“), wenn sie als Medien- oder Nachrichten-App deklariert sind und in den
 * Android-Auto-Entwickleroptionen „Unbekannte Quellen“ aktiv ist. Template-Apps (CarAppService)
 * erscheinen im echten Auto nur bei Verteilung über Google Play, „CAR_LAUNCHER“ gilt nur für Spiele.
 *
 * Der Browse-Baum zeigt dieselben Daten wie Widget und Template-App (SharedPreferences des Widgets):
 *   Heute / Morgen / Übermorgen → Einträge des Tages, „Weitere Tage“, Einkaufsliste, Aufgaben.
 * Antippen eines Eintrags liest ihn per Sprachausgabe vor (nichts muss gelesen oder bedient werden).
 * Nur Framework-Klassen, keine zusätzliche Bibliothek.
 */
public class FamilyMediaBrowserService extends MediaBrowserService {
    private static final String ROOT = "root";
    private static final String DAY = "day:";
    private static final String DAYS = "days:";
    private static final String SAY_DAY = "say:day:";
    private static final String SAY_ENTRY = "say:entry:"; // say:entry:<date>:<index im Tag>
    private static final String SAY_SHOP = "say:shop";
    private static final String SAY_TASKS = "say:tasks";
    private static final int MAX_ENTRIES_PER_DAY = 20;
    private static final int DAYS_PER_PAGE = 7;

    private MediaSession session;
    private TextToSpeech tts;
    private boolean ttsReady;
    private String pendingSpeech; // Text, der kam, bevor die Sprachausgabe bereit war
    private String pendingTitle;

    @Override
    public void onCreate() {
        super.onCreate();
        session = new MediaSession(this, "Familienplaner");
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlayFromMediaId(String mediaId, Bundle extras) {
                speakFor(mediaId);
            }

            @Override
            public void onStop() {
                stopSpeaking();
            }

            @Override
            public void onPause() {
                stopSpeaking();
            }
        });
        // Tippen auf „Läuft gerade“ öffnet die App auf dem Handy
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        session.setSessionActivity(PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        setState(PlaybackState.STATE_NONE);
        session.setActive(true);
        setSessionToken(session.getSessionToken());
        tts = new TextToSpeech(getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS) return;
            tts.setLanguage(Locale.GERMANY);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    setState(PlaybackState.STATE_PLAYING);
                }

                @Override
                public void onDone(String utteranceId) {
                    setState(PlaybackState.STATE_STOPPED);
                }

                @Override
                public void onError(String utteranceId) {
                    setState(PlaybackState.STATE_STOPPED);
                }
            });
            ttsReady = true;
            if (pendingSpeech != null) {
                speak(pendingTitle, pendingSpeech);
                pendingSpeech = null;
            }
        });
    }

    @Override
    public void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        session.setActive(false);
        session.release();
        super.onDestroy();
    }

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        // Der Plan ist privat: nur Android Auto, Google-Assistent/System und die App selbst dürfen den Baum lesen.
        // Debug-Builds (die Sideload-APK) lassen alle zu, damit Test-Hosts wie die DHU nicht scheitern.
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        boolean known = clientUid == Process.SYSTEM_UID
                || getPackageName().equals(clientPackageName)
                || "com.google.android.projection.gearhead".equals(clientPackageName)
                || "com.google.android.googlequicksearchbox".equals(clientPackageName)
                || "com.android.systemui".equals(clientPackageName);
        return debuggable || known ? new BrowserRoot(ROOT, null) : null;
    }

    @Override
    public void onLoadChildren(String parentId, Result<List<MediaBrowser.MediaItem>> result) {
        List<MediaBrowser.MediaItem> items = new ArrayList<>();
        try {
            JSONObject root = FamilyCarAppService.loadData(this);
            if (ROOT.equals(parentId)) rootItems(root, items);
            else if (parentId.startsWith(DAYS)) daysItems(root, Integer.parseInt(parentId.substring(DAYS.length())), items);
            else if (parentId.startsWith(DAY)) dayItems(root, parentId.substring(DAY.length()), items);
        } catch (Exception ignored) {
            // leere Liste statt Absturz
        }
        result.sendResult(items);
    }

    // ---- Browse-Baum ---------------------------------------------------------------------------

    private void rootItems(JSONObject root, List<MediaBrowser.MediaItem> out) {
        JSONArray days = root != null ? root.optJSONArray("days") : null;
        if (days == null || days.length() == 0) {
            out.add(leaf(SAY_DAY + FamilyCarAppService.todayIso(), "Noch keine Daten", "Einmal die App auf dem Handy öffnen"));
            return;
        }
        int idx = FamilyCarAppService.todayIndex(days);
        int from = idx >= 0 ? idx : 0;
        String[] rel = {"Heute", "Morgen", "Übermorgen"};
        for (int i = 0; i < 3 && from + i < days.length(); i++) {
            JSONObject d = days.optJSONObject(from + i);
            if (d == null) continue;
            out.add(dayFolder(d, idx >= 0 ? rel[i] + " · " : ""));
        }
        if (from + 3 < days.length()) out.add(folder(DAYS + (from + 3), "Weitere Tage", "Alle " + days.length() + " Tage im Blick"));
        out.add(leaf(SAY_SHOP, "Einkaufsliste", root.optInt("shopN", 0) + " offen"));
        out.add(leaf(SAY_TASKS, "Aufgaben", taskSummary(root)));
    }

    private void daysItems(JSONObject root, int from, List<MediaBrowser.MediaItem> out) {
        JSONArray days = root != null ? root.optJSONArray("days") : null;
        if (days == null) return;
        for (int i = from; i < days.length() && i < from + DAYS_PER_PAGE; i++) {
            JSONObject d = days.optJSONObject(i);
            if (d != null) out.add(dayFolder(d, ""));
        }
        if (from + DAYS_PER_PAGE < days.length()) out.add(folder(DAYS + (from + DAYS_PER_PAGE), "Weiter", "Spätere Tage"));
    }

    private void dayItems(JSONObject root, String date, List<MediaBrowser.MediaItem> out) {
        List<JSONObject> entries = entriesOf(root, date);
        out.add(leaf(SAY_DAY + date, "Tag vorlesen", entries.isEmpty() ? "Nichts geplant" : entries.size() + (entries.size() == 1 ? " Eintrag" : " Einträge")));
        for (int i = 0; i < entries.size() && i < MAX_ENTRIES_PER_DAY; i++) {
            JSONObject e = entries.get(i);
            String time = e.optString("time", "");
            String kl = FamilyCarAppService.kindLabel(e.optString("kind", ""));
            String detail = e.optString("detail", "");
            String sub = detail.isEmpty() ? kl : (kl.isEmpty() ? detail : kl + " · " + detail);
            out.add(leaf(SAY_ENTRY + date + ":" + i, (time.isEmpty() ? "" : time + "  ") + e.optString("title", ""), sub));
        }
    }

    private MediaBrowser.MediaItem dayFolder(JSONObject d, String prefix) {
        String date = d.optString("date");
        int n = d.optInt("n", 0);
        String sub = (n == 0 ? "nichts geplant" : n + (n == 1 ? " Eintrag" : " Einträge")) + FamilyCarAppService.covNote(d.optString("cov", "none"));
        return folder(DAY + date, prefix + FamilyCarAppService.dayLabel(date), sub);
    }

    private static String taskSummary(JSONObject root) {
        int today = root.optInt("taskToday", 0);
        int overdue = root.optInt("taskOverdue", 0);
        String s = root.optInt("taskN", 0) + " aktiv";
        if (today > 0) s += " · " + today + " heute";
        if (overdue > 0) s += " · " + overdue + " überfällig";
        return s;
    }

    private static List<JSONObject> entriesOf(JSONObject root, String date) {
        List<JSONObject> list = new ArrayList<>();
        JSONArray entries = root != null ? root.optJSONArray("entries") : null;
        if (entries == null) return list;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject e = entries.optJSONObject(i);
            if (e != null && date.equals(e.optString("date"))) list.add(e);
        }
        return list;
    }

    private static MediaBrowser.MediaItem folder(String id, String title, String subtitle) {
        return item(id, title, subtitle, MediaBrowser.MediaItem.FLAG_BROWSABLE);
    }

    private static MediaBrowser.MediaItem leaf(String id, String title, String subtitle) {
        return item(id, title, subtitle, MediaBrowser.MediaItem.FLAG_PLAYABLE);
    }

    private static MediaBrowser.MediaItem item(String id, String title, String subtitle, int flags) {
        MediaDescription d = new MediaDescription.Builder().setMediaId(id).setTitle(title).setSubtitle(subtitle).build();
        return new MediaBrowser.MediaItem(d, flags);
    }

    // ---- Vorlesen -------------------------------------------------------------------------------

    private void speakFor(String mediaId) {
        JSONObject root = FamilyCarAppService.loadData(this);
        String title = "Familienplaner";
        String text;
        try {
            if (mediaId.startsWith(SAY_DAY)) {
                String date = mediaId.substring(SAY_DAY.length());
                title = FamilyCarAppService.dayLabel(date);
                text = spokenDay(root, date);
            } else if (mediaId.startsWith(SAY_ENTRY)) {
                String[] p = mediaId.substring(SAY_ENTRY.length()).split(":");
                List<JSONObject> entries = entriesOf(root, p[0]);
                JSONObject e = entries.get(Integer.parseInt(p[1]));
                title = e.optString("title", "");
                text = spokenEntry(e);
            } else if (SAY_SHOP.equals(mediaId)) {
                title = "Einkaufsliste";
                int n = root != null ? root.optInt("shopN", 0) : 0;
                text = n == 0 ? "Die Einkaufsliste ist leer." : "Auf der Einkaufsliste stehen " + n + (n == 1 ? " offener Artikel." : " offene Artikel.");
            } else if (SAY_TASKS.equals(mediaId)) {
                title = "Aufgaben";
                text = root == null ? "Keine Daten." : "Aufgaben: " + taskSummary(root).replace("·", ",") + ".";
            } else {
                return;
            }
        } catch (Exception e) {
            text = "Dazu liegen keine Daten vor.";
        }
        speak(title, text);
    }

    private static String spokenEntry(JSONObject e) {
        String time = e.optString("time", "");
        String detail = e.optString("detail", "");
        return (time.isEmpty() ? "" : time.replace("–", " bis ") + " Uhr, ") + e.optString("title", "") + (detail.isEmpty() ? "" : ", " + detail);
    }

    private static String spokenDay(JSONObject root, String date) {
        String name;
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).parse(date);
            name = new SimpleDateFormat("EEEE, d. MMMM", Locale.GERMANY).format(d);
        } catch (Exception e) {
            name = date;
        }
        List<JSONObject> entries = entriesOf(root, date);
        if (entries.isEmpty()) return name + ": nichts geplant.";
        StringBuilder sb = new StringBuilder(name).append(": ").append(entries.size()).append(entries.size() == 1 ? " Eintrag. " : " Einträge. ");
        for (int i = 0; i < entries.size() && i < MAX_ENTRIES_PER_DAY; i++) sb.append(spokenEntry(entries.get(i))).append(". ");
        JSONArray days = root != null ? root.optJSONArray("days") : null;
        if (days != null) {
            for (int i = 0; i < days.length(); i++) {
                JSONObject d = days.optJSONObject(i);
                if (d != null && date.equals(d.optString("date")) && "gap".equals(d.optString("cov"))) sb.append("Achtung, Betreuung ungeklärt.");
            }
        }
        return sb.toString();
    }

    private void speak(String title, String text) {
        session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, "Familienplaner")
                .build());
        if (!ttsReady) {
            pendingTitle = title;
            pendingSpeech = text;
            setState(PlaybackState.STATE_BUFFERING);
            return;
        }
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "familienplaner");
    }

    private void stopSpeaking() {
        pendingSpeech = null;
        if (tts != null) tts.stop();
        setState(PlaybackState.STATE_STOPPED);
    }

    private void setState(int state) {
        long actions = PlaybackState.ACTION_PLAY_FROM_MEDIA_ID | PlaybackState.ACTION_STOP | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY;
        session.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(state, 0, 1f).build());
    }
}

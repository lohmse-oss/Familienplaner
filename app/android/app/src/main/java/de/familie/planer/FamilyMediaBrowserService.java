package de.familie.planer;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.media.MediaDescription;
import android.media.MediaMetadata;
import android.media.browse.MediaBrowser;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Bundle;
import android.os.Process;
import android.service.media.MediaBrowserService;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Android Auto: Familienplaner als Medien-App im Auto-Launcher – grafisch, ohne Vorlesen.
 *
 * Warum Medien-App? Android Auto zeigt per Sideload installierte Apps nur dann im Launcher („Launcher anpassen“),
 * wenn sie als Medien- oder Nachrichten-App deklariert sind und in den Android-Auto-Entwickleroptionen
 * „Unbekannte Quellen“ aktiv ist. Template-Apps (CarAppService) erscheinen im echten Auto nur bei Play-Verteilung.
 *
 * Startseite als Kachel-Raster wie das Homescreen-Widget: Heute, Morgen, Übermorgen (Kreis mit Anzahl, rot =
 * Betreuung ungeklärt), Weitere Tage, Einkauf, Aufgaben. Ein Tag zeigt seine Einträge als Liste mit farbigen Symbolen
 * (Farbe der Person), gruppiert in „Ganztägig“ und „Mit Uhrzeit“. Antippen eines Eintrags oder der „Tagesübersicht“
 * zeigt eine große Grafik in der Ansicht „Läuft gerade“ – es wird nichts abgespielt oder vorgelesen.
 * Bilder liefert CarArtProvider (content://…carart/…).
 */
public class FamilyMediaBrowserService extends MediaBrowserService {
    private static final String ROOT = "root";
    private static final String DAY = "day:";
    private static final String DAYS = "days:";
    private static final String SHOP = "shop";
    private static final String TASKS = "tasks";
    private static final String SHOW_DAY = "show:day:";
    private static final String SHOW_ENTRY = "show:entry:"; // show:entry:<date>:<index im Tag>
    private static final String NOOP = "noop:";
    private static final int MAX_ENTRIES_PER_DAY = 20;
    private static final int DAYS_PER_PAGE = 7;

    // Darstellungs-Hinweise für Android Auto (androidx.media.utils.MediaConstants, hier als Klartext ohne Zusatzbibliothek)
    private static final String STYLE_SUPPORTED = "android.media.browse.CONTENT_STYLE_SUPPORTED";
    private static final String STYLE_BROWSABLE = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT";
    private static final String STYLE_PLAYABLE = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT";
    private static final String STYLE_GROUP = "android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT";
    private static final int STYLE_LIST = 1;
    private static final int STYLE_GRID = 2;

    private static final String[] AUTO_HOSTS = {"com.google.android.projection.gearhead", "com.google.android.googlequicksearchbox", "com.android.systemui"};

    private MediaSession session;

    @Override
    public void onCreate() {
        super.onCreate();
        session = new MediaSession(this, "Familienplaner");
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlayFromMediaId(String mediaId, Bundle extras) {
                show(mediaId);
            }
        });
        // Tippen auf „Läuft gerade“ öffnet die App auf dem Handy
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        session.setSessionActivity(PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        setState(PlaybackState.STATE_NONE);
        session.setActive(true);
        setSessionToken(session.getSessionToken());
    }

    @Override
    public void onDestroy() {
        session.setActive(false);
        session.release();
        super.onDestroy();
    }

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        // Der Plan ist privat: nur Android Auto, Google-Assistent/System und die App selbst dürfen den Baum lesen.
        // Debug-Builds (die Sideload-APK) lassen alle zu, damit Test-Hosts wie die DHU nicht scheitern.
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        boolean known = clientUid == Process.SYSTEM_UID || getPackageName().equals(clientPackageName);
        for (String h : AUTO_HOSTS) known |= h.equals(clientPackageName);
        if (!debuggable && !known) return null;
        // Bilder (content://…carart/) für den Host lesbar machen
        try {
            Uri base = new Uri.Builder().scheme("content").authority(getPackageName() + ".carart").build();
            grantUriPermission(clientPackageName, base, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        } catch (Exception ignored) {
            // ohne Rechte zeigt das Auto nur Text
        }
        Bundle extras = new Bundle();
        extras.putBoolean(STYLE_SUPPORTED, true);
        extras.putInt(STYLE_BROWSABLE, STYLE_GRID); // Startseite: Kacheln
        extras.putInt(STYLE_PLAYABLE, STYLE_LIST); // Einträge: Liste mit Symbolen
        return new BrowserRoot(ROOT, extras);
    }

    @Override
    public void onLoadChildren(String parentId, Result<List<MediaBrowser.MediaItem>> result) {
        List<MediaBrowser.MediaItem> items = new ArrayList<>();
        try {
            JSONObject root = FamilyCarAppService.loadData(this);
            String v = version(root);
            if (ROOT.equals(parentId)) rootItems(root, v, items);
            else if (parentId.startsWith(DAYS)) daysItems(root, v, Integer.parseInt(parentId.substring(DAYS.length())), items);
            else if (parentId.startsWith(DAY)) dayItems(root, v, parentId.substring(DAY.length()), items);
            else if (SHOP.equals(parentId)) shopItems(root, v, items);
            else if (TASKS.equals(parentId)) taskItems(root, v, items);
        } catch (Exception ignored) {
            // leere Liste statt Absturz
        }
        result.sendResult(items);
    }

    // ---- Browse-Baum ---------------------------------------------------------------------------

    private void rootItems(JSONObject root, String v, List<MediaBrowser.MediaItem> out) {
        JSONArray days = root != null ? root.optJSONArray("days") : null;
        if (days == null || days.length() == 0) {
            out.add(item(NOOP + "empty", "Noch keine Daten", "Einmal die App auf dem Handy öffnen", art("tile/week", v), MediaBrowser.MediaItem.FLAG_PLAYABLE, null));
            return;
        }
        int idx = FamilyCarAppService.todayIndex(days);
        int from = idx >= 0 ? idx : 0;
        String[] rel = {"Heute", "Morgen", "Übermorgen"};
        for (int i = 0; i < 3 && from + i < days.length(); i++) {
            JSONObject d = days.optJSONObject(from + i);
            if (d == null) continue;
            String label = idx >= 0 ? rel[i] : "";
            out.add(dayFolder(d, label, v));
        }
        if (from + 3 < days.length()) out.add(folder(DAYS + (from + 3), "Weitere Tage", (days.length() - from - 3) + " Tage", art("tile/week", v), STYLE_LIST));
        int shopN = root.optInt("shopN", 0);
        out.add(folder(SHOP, "Einkauf", shopN == 0 ? "alles besorgt" : shopN + " offen", art("tile/shop", v), STYLE_LIST));
        out.add(folder(TASKS, "Aufgaben", taskSummary(root), art("tile/tasks", v), STYLE_LIST));
    }

    private void daysItems(JSONObject root, String v, int from, List<MediaBrowser.MediaItem> out) {
        JSONArray days = root != null ? root.optJSONArray("days") : null;
        if (days == null) return;
        for (int i = from; i < days.length() && i < from + DAYS_PER_PAGE; i++) {
            JSONObject d = days.optJSONObject(i);
            if (d != null) out.add(dayFolder(d, "", v));
        }
        if (from + DAYS_PER_PAGE < days.length()) out.add(folder(DAYS + (from + DAYS_PER_PAGE), "Weiter", "Spätere Tage", art("tile/week", v), STYLE_LIST));
    }

    private void dayItems(JSONObject root, String v, String date, List<MediaBrowser.MediaItem> out) {
        List<JSONObject> entries = CarArt.entriesOf(root, date);
        JSONObject d = CarArt.findDay(root, date);
        String cov = d != null ? d.optString("cov", "none") : "none";
        out.add(item(SHOW_DAY + date, "Tagesübersicht", (entries.isEmpty() ? "nichts geplant" : entries.size() + (entries.size() == 1 ? " Eintrag" : " Einträge")) + FamilyCarAppService.covNote(cov),
                art("tile/day/" + date + "/", v), MediaBrowser.MediaItem.FLAG_PLAYABLE, null));
        for (int i = 0; i < entries.size() && i < MAX_ENTRIES_PER_DAY; i++) {
            JSONObject e = entries.get(i);
            String time = e.optString("time", "");
            String detail = e.optString("detail", "");
            String kind = e.optString("kind", "");
            String sub = detail.isEmpty() ? kindLabel(kind) : detail;
            String col = e.optString("color", "").replace("#", "");
            out.add(item(SHOW_ENTRY + date + ":" + i, (time.isEmpty() ? "" : time + "  ") + e.optString("title", ""), sub,
                    art("icon/" + kind + "/" + e.optString("mode", "-") + "/" + col, v), MediaBrowser.MediaItem.FLAG_PLAYABLE,
                    time.isEmpty() ? "Ganztägig" : "Mit Uhrzeit"));
        }
    }

    private void shopItems(JSONObject root, String v, List<MediaBrowser.MediaItem> out) {
        JSONArray shop = root != null ? root.optJSONArray("shop") : null;
        if (shop == null || shop.length() == 0) {
            out.add(item(NOOP + "shop", "Alles besorgt", "Die Einkaufsliste ist leer", art("icon/shop/-/", v), MediaBrowser.MediaItem.FLAG_PLAYABLE, null));
            return;
        }
        for (int i = 0; i < shop.length(); i++)
            out.add(item(NOOP + "shop:" + i, shop.optString(i), "Einkaufsliste", art("icon/shop/-/", v), MediaBrowser.MediaItem.FLAG_PLAYABLE, null));
    }

    private void taskItems(JSONObject root, String v, List<MediaBrowser.MediaItem> out) {
        JSONArray tasks = root != null ? root.optJSONArray("taskList") : null;
        if (tasks == null || tasks.length() == 0) {
            out.add(item(NOOP + "tasks", "Nichts offen", "Keine aktiven Aufgaben", art("icon/task/-/", v), MediaBrowser.MediaItem.FLAG_PLAYABLE, null));
            return;
        }
        String today = FamilyCarAppService.todayIso();
        for (int i = 0; i < tasks.length(); i++) {
            JSONObject t = tasks.optJSONObject(i);
            if (t == null) continue;
            boolean late = t.optBoolean("late", false);
            String due = t.optString("due", "");
            String sub = late ? "überfällig seit " + CarArt.shortDate(due) : today.equals(due) ? "heute fällig" : "fällig " + FamilyCarAppService.dayLabel(due);
            String col = t.optString("color", "").replace("#", "");
            out.add(item(NOOP + "task:" + i, t.optString("title", ""), sub, art("icon/task/" + (late ? "late" : "-") + "/" + col, v), MediaBrowser.MediaItem.FLAG_PLAYABLE,
                    late ? "Überfällig" : today.equals(due) ? "Heute" : "Demnächst"));
        }
    }

    private MediaBrowser.MediaItem dayFolder(JSONObject d, String label, String v) {
        String date = d.optString("date");
        int n = d.optInt("n", 0);
        String sub = (n == 0 ? "nichts geplant" : n + (n == 1 ? " Eintrag" : " Einträge")) + FamilyCarAppService.covNote(d.optString("cov", "none"));
        String title = label.isEmpty() ? FamilyCarAppService.dayLabel(date) : label;
        return folder(DAY + date, title, label.isEmpty() ? sub : FamilyCarAppService.dayLabel(date) + " · " + sub, art("tile/day/" + date + "/" + label, v), STYLE_LIST);
    }

    private static String taskSummary(JSONObject root) {
        int today = root.optInt("taskToday", 0);
        int overdue = root.optInt("taskOverdue", 0);
        String s = root.optInt("taskN", 0) + " aktiv";
        if (overdue > 0) s += " · " + overdue + " überfällig";
        else if (today > 0) s += " · " + today + " heute";
        return s;
    }

    static String kindLabel(String kind) {
        switch (kind) {
            case "event": return "Termin";
            case "info": return "Event";
            case "task": return "Aufgabe";
            case "birthday": return "Geburtstag";
            case "presence": return "Anwesenheit";
            case "care": return "Betreuungsbedarf";
            case "cover": return "Betreuung";
            default: return "";
        }
    }

    // ---- Bausteine ---------------------------------------------------------------------------

    /** Datenstand – ändert sich mit jedem Abgleich, damit das Auto neue Bilder lädt. */
    private static String version(JSONObject root) {
        if (root == null) return "0";
        return Integer.toHexString((root.optString("updated", "") + root.optString("days", "").length() + root.optInt("shopN") + root.optInt("taskN")).hashCode());
    }

    private Uri art(String path, String v) {
        return CarArtProvider.uri(this, path, v);
    }

    private static MediaBrowser.MediaItem folder(String id, String title, String subtitle, Uri icon, int childStyle) {
        Bundle extras = new Bundle();
        extras.putInt(STYLE_BROWSABLE, childStyle);
        extras.putInt(STYLE_PLAYABLE, STYLE_LIST);
        MediaDescription d = new MediaDescription.Builder().setMediaId(id).setTitle(title).setSubtitle(subtitle).setIconUri(icon).setExtras(extras).build();
        return new MediaBrowser.MediaItem(d, MediaBrowser.MediaItem.FLAG_BROWSABLE);
    }

    private static MediaBrowser.MediaItem item(String id, String title, String subtitle, Uri icon, int flags, String group) {
        MediaDescription.Builder b = new MediaDescription.Builder().setMediaId(id).setTitle(title).setSubtitle(subtitle).setIconUri(icon);
        if (group != null) {
            Bundle extras = new Bundle();
            extras.putString(STYLE_GROUP, group);
            b.setExtras(extras);
        }
        return new MediaBrowser.MediaItem(b.build(), flags);
    }

    // ---- „Läuft gerade“: große Grafik statt Vorlesen ----------------------------------------------

    private void show(String mediaId) {
        if (mediaId == null || mediaId.startsWith(NOOP)) return;
        JSONObject root = FamilyCarAppService.loadData(this);
        String v = version(root);
        String title;
        String subtitle;
        String path;
        try {
            if (mediaId.startsWith(SHOW_DAY)) {
                String date = mediaId.substring(SHOW_DAY.length());
                int n = CarArt.entriesOf(root, date).size();
                title = CarArt.longDate(date);
                subtitle = n == 0 ? "nichts geplant" : n + (n == 1 ? " Eintrag" : " Einträge");
                path = "card/day/" + date;
            } else if (mediaId.startsWith(SHOW_ENTRY)) {
                String[] p = mediaId.substring(SHOW_ENTRY.length()).split(":");
                JSONObject e = CarArt.entriesOf(root, p[0]).get(Integer.parseInt(p[1]));
                String time = e.optString("time", "");
                title = e.optString("title", "");
                subtitle = CarArt.longDate(p[0]) + (time.isEmpty() ? "" : " · " + time) + (e.optString("detail", "").isEmpty() ? "" : " · " + e.optString("detail"));
                path = "card/entry/" + p[0] + "/" + p[1];
            } else {
                return;
            }
        } catch (Exception e) {
            return;
        }
        Uri artUri = art(path, v);
        session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, mediaId)
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, subtitle)
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, subtitle)
                .putString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI, artUri.toString())
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI, artUri.toString())
                .build());
        setState(PlaybackState.STATE_PAUSED); // zeigt die Karte, ohne etwas abzuspielen
    }

    private void setState(int state) {
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY_FROM_MEDIA_ID).setState(state, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 0f).build());
    }
}

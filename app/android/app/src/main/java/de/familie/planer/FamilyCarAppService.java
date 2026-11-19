package de.familie.planer;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.car.app.validation.HostValidator;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Android Auto: Der Familienplaner als Template-App im Auto-Launcher (Kategorie POI – für solche Apps
 * ist Android Auto nur im geparkten Zustand nutzbar). Liest dieselben Daten wie das Homescreen-Widget
 * aus den SharedPreferences und zeigt die nächsten Tage mit allen Terminen an.
 * Antippen öffnet die App auf dem Handy (de.familie.planer://...).
 */
public class FamilyCarAppService extends CarAppService {

    @NonNull
    @Override
    public Session onCreateSession() {
        return new FamilyCarSession();
    }

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        // Debug-Builds dürfen auch den Desktop Head Unit (Test-Host) bedienen
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        return new HostValidator.Builder(getApplicationContext()).addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample).build();
    }

    /** Widget-Daten aus den SharedPreferences (null = App wurde noch nie gestartet). */
    static JSONObject loadData(Context ctx) {
        try {
            String json = ctx.getSharedPreferences(FamilyWidgetProvider.PREFS, Context.MODE_PRIVATE).getString(FamilyWidgetProvider.KEY_DATA, null);
            return json != null ? new JSONObject(json) : null;
        } catch (Exception e) {
            return null;
        }
    }

    static String todayIso() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).format(new Date());
    }

    /** Heutiger Index in den Tagesdaten oder -1 (Daten evtl. von gestern). */
    static int todayIndex(JSONArray days) {
        if (days == null) return -1;
        String today = todayIso();
        for (int i = 0; i < days.length(); i++) {
            if (today.equals(days.optJSONObject(i).optString("date"))) return i;
        }
        return -1;
    }

    /** "Mo, 12.07." */
    static String dayLabel(String iso) {
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).parse(iso);
            return new SimpleDateFormat("EEE, dd.MM.", Locale.GERMANY).format(d);
        } catch (Exception e) {
            return iso;
        }
    }

    static String covNote(String cov) {
        if ("gap".equals(cov)) return " · Betreuung ungeklärt!";
        if ("maybe".equals(cov)) return " · Betreuung evtl. kritisch";
        return "";
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

    /** App auf dem Handy öffnen (nur geparkt möglich) mit Direktlink. */
    static void openApp(CarContext ctx, String uri) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setData(Uri.parse(uri));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startCarApp(i);
    }

    static class FamilyCarSession extends Session {
        @NonNull
        @Override
        public Screen onCreateScreen(@NonNull Intent intent) {
            return new RootScreen(getCarContext());
        }
    }

    /** Startseite: heute, morgen, übermorgen + weitere Tage, Einkaufsliste, Aufgaben. Max. 6 Reihen (Host-Limit). */
    static class RootScreen extends Screen {
        private final Template template;

        RootScreen(CarContext carContext) {
            super(carContext);
            JSONObject root = loadData(carContext);
            JSONArray days = root != null ? root.optJSONArray("days") : null;
            ItemList.Builder list = new ItemList.Builder();
            if (days == null || days.length() == 0) {
                list.addItem(new Row.Builder()
                        .setTitle("App öffnen")
                        .addText("Noch keine Daten – einmal auf dem Handy öffnen")
                        .setOnClickListener(() -> openApp(carContext, "de.familie.planer://today"))
                        .build());
            } else {
                int idx = todayIndex(days);
                int from = idx >= 0 ? idx : 0;
                String[] rel = {"Heute", "Morgen", "Übermorgen"};
                for (int i = 0; i < 3 && from + i < days.length(); i++) {
                    JSONObject d = days.optJSONObject(from + i);
                    String date = d.optString("date");
                    int n = d.optInt("n", 0);
                    String title = (idx >= 0 ? rel[i] + " · " : "") + dayLabel(date);
                    String sub = (n == 0 ? "nichts geplant" : n + (n == 1 ? " Eintrag" : " Einträge")) + covNote(d.optString("cov", "none"));
                    list.addItem(new Row.Builder()
                            .setTitle(title)
                            .addText(sub)
                            .setOnClickListener(() -> getScreenManager().push(new DayScreen(getCarContext(), date)))
                            .build());
                }
                final int moreFrom = from + 3;
                if (moreFrom < days.length()) {
                    list.addItem(new Row.Builder()
                            .setTitle("Weitere Tage")
                            .addText("Alle " + days.length() + " Tage im Blick")
                            .setOnClickListener(() -> getScreenManager().push(new DaysScreen(getCarContext(), moreFrom)))
                            .build());
                }
                list.addItem(new Row.Builder()
                        .setTitle("Einkaufsliste")
                        .addText(root.optInt("shopN", 0) + " offen")
                        .setOnClickListener(() -> openApp(carContext, "de.familie.planer://shop"))
                        .build());
                int taskN = root.optInt("taskN", 0);
                int today = root.optInt("taskToday", 0);
                int overdue = root.optInt("taskOverdue", 0);
                String tsub = taskN + " aktiv";
                if (today > 0) tsub += " · " + today + " heute";
                if (overdue > 0) tsub += " · " + overdue + " überfällig";
                list.addItem(new Row.Builder()
                        .setTitle("Aufgaben")
                        .addText(tsub)
                        .setOnClickListener(() -> openApp(carContext, "de.familie.planer://tasks"))
                        .build());
            }
            template = new ListTemplate.Builder().setTitle("Familienplaner").setSingleList(list.build()).build();
        }

        @NonNull
        @Override
        public Template onGetTemplate() {
            return template;
        }
    }

    /** Ein Tag im Detail: alle Einträge chronologisch (max. 5 + Hinweis auf weitere). */
    static class DayScreen extends Screen {
        private final Template template;

        DayScreen(CarContext carContext, String date) {
            super(carContext);
            JSONObject root = loadData(carContext);
            JSONArray entries = root != null ? root.optJSONArray("entries") : null;
            ItemList.Builder list = new ItemList.Builder();
            int shown = 0;
            int total = 0;
            if (entries != null) {
                for (int i = 0; i < entries.length(); i++) {
                    JSONObject e = entries.optJSONObject(i);
                    if (e == null || !date.equals(e.optString("date"))) continue;
                    total++;
                    if (shown >= 5) continue;
                    shown++;
                    String time = e.optString("time", "");
                    String kl = kindLabel(e.optString("kind", ""));
                    String detail = e.optString("detail", "");
                    String sub = detail.isEmpty() ? kl : (kl.isEmpty() ? detail : kl + " · " + detail);
                    list.addItem(new Row.Builder()
                            .setTitle((time.isEmpty() ? "" : time + "  ") + e.optString("title", ""))
                            .addText(sub)
                            .setOnClickListener(() -> openApp(carContext, "de.familie.planer://day/" + date))
                            .build());
                }
            }
            if (total > shown) {
                list.addItem(new Row.Builder()
                        .setTitle("… und " + (total - shown) + " weitere")
                        .addText("In der App ansehen")
                        .setOnClickListener(() -> openApp(carContext, "de.familie.planer://day/" + date))
                        .build());
            }
            if (total == 0) {
                list.addItem(new Row.Builder().setTitle("Nichts geplant").build());
                list.addItem(new Row.Builder()
                        .setTitle("In der App öffnen")
                        .setOnClickListener(() -> openApp(carContext, "de.familie.planer://day/" + date))
                        .build());
            }
            template = new ListTemplate.Builder().setTitle(dayLabel(date)).setSingleList(list.build()).build();
        }

        @NonNull
        @Override
        public Template onGetTemplate() {
            return template;
        }
    }

    /** Weitere Tage ab Index `from` (je 5 + "Weiter"). */
    static class DaysScreen extends Screen {
        private final Template template;

        DaysScreen(CarContext carContext, int from) {
            super(carContext);
            JSONObject root = loadData(carContext);
            JSONArray days = root != null ? root.optJSONArray("days") : null;
            ItemList.Builder list = new ItemList.Builder();
            boolean any = false;
            if (days != null) {
                int shown = 0;
                for (int i = from; i < days.length() && shown < 5; i++, shown++) {
                    JSONObject d = days.optJSONObject(i);
                    if (d == null) continue;
                    any = true;
                    String date = d.optString("date");
                    int n = d.optInt("n", 0);
                    list.addItem(new Row.Builder()
                            .setTitle(dayLabel(date))
                            .addText((n == 0 ? "nichts geplant" : n + (n == 1 ? " Eintrag" : " Einträge")) + covNote(d.optString("cov", "none")))
                            .setOnClickListener(() -> getScreenManager().push(new DayScreen(getCarContext(), date)))
                            .build());
                }
                if (from + shown < days.length()) {
                    final int next = from + shown;
                    list.addItem(new Row.Builder()
                            .setTitle("Weiter")
                            .setOnClickListener(() -> getScreenManager().push(new DaysScreen(getCarContext(), next)))
                            .build());
                }
            }
            if (!any) {
                list.addItem(new Row.Builder()
                        .setTitle("App öffnen")
                        .setOnClickListener(() -> openApp(carContext, "de.familie.planer://today"))
                        .build());
            }
            template = new ListTemplate.Builder().setTitle("Nächste Tage").setSingleList(list.build()).build();
        }

        @NonNull
        @Override
        public Template onGetTemplate() {
            return template;
        }
    }
}

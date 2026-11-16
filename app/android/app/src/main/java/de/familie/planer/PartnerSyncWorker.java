package de.familie.planer;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.IOException;
import java.util.List;
import org.json.JSONObject;

/** Periodischer Hintergrund-Abgleich (siehe PartnerSync). */
public class PartnerSyncWorker extends Worker {
    public PartnerSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences sp = ctx.getSharedPreferences(PartnerSync.PREFS, Context.MODE_PRIVATE);
        String server = sp.getString("server", "");
        String code = sp.getString("code", "");
        String me = sp.getString("me", "");
        if (server.length() == 0 || code.length() == 0) return Result.success();

        long seen = sp.getLong("seen", 0);
        try {
            JSONObject res = PartnerSync.fetch(server, code, seen);
            long rev = res.getLong("rev");
            if (seen == 0) {
                // erster Lauf ohne Stand: nur merken, nichts melden
                sp.edit().putLong("seen", rev).apply();
                return Result.success();
            }
            if (sp.getBoolean("notify", true)) {
                List<JSONObject> changes = PartnerSync.partnerChanges(res.getJSONArray("items"), me);
                PartnerSync.notifyChanges(ctx, changes);
            }
            if (rev > seen) sp.edit().putLong("seen", rev).apply();
            return Result.success();
        } catch (SecurityException e) {
            return Result.success(); // falscher Code: nicht ständig neu versuchen
        } catch (IOException e) {
            return Result.retry();
        } catch (Exception e) {
            return Result.failure();
        }
    }
}

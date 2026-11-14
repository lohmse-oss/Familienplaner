package dev.lohmse.familienplaner.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

// Persistenz als state.json im App-Verzeichnis – gleiche Feldnamen wie die Web-App,
// damit Sync-Server/Worker und JSON-Ex/Import kompatibel bleiben.

object StateStore {

  private fun file(ctx: Context) = File(ctx.filesDir, "state.json")

  fun load(ctx: Context): AppState {
    val f = file(ctx)
    if (!f.exists()) return defaultState()
    return try { fromJson(JSONObject(f.readText())) } catch (e: Exception) { defaultState() }
  }

  fun save(ctx: Context, state: AppState) {
    try {
      file(ctx).writeText(toJson(state).toString(2))
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  fun toJson(s: AppState): JSONObject = JSONObject().apply {
    put("version", s.version)
    put("ansicht", s.ansicht)
    put("wandModus", JSONObject(s.wandModus))
    put("jahr", s.jahr)
    put("mitglieder", JSONArray().apply {
      for (m in s.mitglieder) put(JSONObject().apply {
        put("id", m.id); put("name", m.name); put("rolle", m.rolle); put("farbe", m.farbe)
        put("urlaubstage", m.urlaubstage); put("resturlaubVorjahr", m.resturlaubVorjahr)
      })
    })
    put("eintraege", JSONArray().apply {
      for (e in s.eintraege) put(JSONObject().apply {
        put("id", e.id); put("mitgliedId", e.mitgliedId); put("typ", e.typ)
        put("von", e.von); put("bis", e.bis); put("titel", e.titel); put("notiz", e.notiz)
        put("jaehrlich", e.jaehrlich)
        if (e.monat != null) put("monat", e.monat)
        if (e.tag != null) put("tag", e.tag)
        if (e.gcalId != null) put("gcalId", e.gcalId)
      })
    })
    put("eigeneFerien", JSONArray().apply {
      for (f in s.eigeneFerien) put(JSONObject().apply {
        put("name", f.name); put("von", f.von); put("bis", f.bis)
      })
    })
    put("einstellungen", JSONObject().apply {
      put("fronleichnamRegional", s.einstellungen.fronleichnamRegional)
      put("gcalClientId", s.einstellungen.gcalClientId)
      put("syncUrl", s.einstellungen.syncUrl)
      put("syncToken", s.einstellungen.syncToken)
      put("geraetName", s.einstellungen.geraetName)
    })
    put("filterMitglied", s.filterMitglied)
    put("updatedAt", s.updatedAt)
    put("updatedBy", s.updatedBy)
  }

  // Export-Datei: wie die Web-App ohne syncToken und ohne updatedAt/updatedBy
  fun toExportJson(s: AppState): JSONObject {
    val j = toJson(s)
    val einstellungen = j.getJSONObject("einstellungen")
    einstellungen.remove("syncToken")
    j.remove("updatedAt")
    j.remove("updatedBy")
    return j
  }

  fun fromJson(j: JSONObject): AppState {
    val s = defaultState()
    s.version = j.optInt("version", 1)
    s.ansicht = j.optString("ansicht", "wand")
    j.optJSONObject("wandModus")?.let { w ->
      w.keys().forEach { s.wandModus[it] = w.getString(it) }
    }
    s.jahr = j.optInt("jahr", s.jahr)
    j.optJSONArray("mitglieder")?.let { arr ->
      s.mitglieder.clear()
      for (i in 0 until arr.length()) {
        val m = arr.getJSONObject(i)
        s.mitglieder.add(Mitglied(
          id = m.getString("id"),
          name = m.optString("name"),
          rolle = m.optString("rolle", "elternteil"),
          farbe = m.optString("farbe", "#2563eb"),
          urlaubstage = m.optInt("urlaubstage", 30),
          resturlaubVorjahr = m.optInt("resturlaubVorjahr", 0)
        ))
      }
    }
    j.optJSONArray("eintraege")?.let { arr ->
      s.eintraege.clear()
      for (i in 0 until arr.length()) {
        val e = arr.getJSONObject(i)
        s.eintraege.add(Eintrag(
          id = e.getString("id"),
          mitgliedId = e.optString("mitgliedId"),
          typ = e.optString("typ", "termin"),
          von = e.optString("von"),
          bis = e.optString("bis"),
          titel = e.optString("titel", ""),
          notiz = e.optString("notiz", ""),
          jaehrlich = e.optBoolean("jaehrlich", false),
          monat = if (e.has("monat")) e.getInt("monat") else null,
          tag = if (e.has("tag")) e.getInt("tag") else null,
          gcalId = if (e.has("gcalId")) e.getString("gcalId") else null
        ))
      }
    }
    j.optJSONArray("eigeneFerien")?.let { arr ->
      s.eigeneFerien.clear()
      for (i in 0 until arr.length()) {
        val f = arr.getJSONObject(i)
        s.eigeneFerien.add(Ferien(f.getString("name"), f.getString("von"), f.getString("bis")))
      }
    }
    j.optJSONObject("einstellungen")?.let { e ->
      s.einstellungen.fronleichnamRegional = e.optBoolean("fronleichnamRegional", false)
      s.einstellungen.gcalClientId = e.optString("gcalClientId", "")
      s.einstellungen.syncUrl = e.optString("syncUrl", "")
      s.einstellungen.syncToken = e.optString("syncToken", "")
      s.einstellungen.geraetName = e.optString("geraetName", "")
    }
    s.filterMitglied = j.optString("filterMitglied", "alle")
    s.updatedAt = j.optLong("updatedAt", 0)
    s.updatedBy = j.optString("updatedBy", "")
    return s
  }

  // Import: wie die Web-App die lokale Sync-Konfiguration behalten
  fun importJson(ctx: Context, s: AppState, data: JSONObject): AppState {
    val localSync = Triple(s.einstellungen.syncUrl, s.einstellungen.syncToken, s.einstellungen.geraetName)
    val merged = fromJson(data)
    merged.einstellungen.syncUrl = localSync.first
    merged.einstellungen.syncToken = localSync.second
    merged.einstellungen.geraetName = localSync.third
    merged.updatedAt = s.updatedAt
    merged.updatedBy = s.updatedBy
    return merged
  }
}
